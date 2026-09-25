<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingQuestionPreset;
use App\Services\Booking\BookingQuestionPresetSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuestionPresetController extends Controller
{
    public function __construct(
        private readonly BookingQuestionPresetSyncService $presetSync,
    ) {
    }

    public function index(Request $request)
    {
        $query = BookingQuestionPreset::query()
            ->withCount('services')
            ->when($request->filled('name'), fn ($q) => $q->where('name', 'like', '%'.$request->string('name').'%'))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name');

        if ($request->boolean('all')) {
            $presets = $query->with(['questions.options.linkedBookingService'])->get();

            return $this->respond(
                $presets->map(fn (BookingQuestionPreset $preset) => $this->presetSync->formatPreset($preset))->values()
            );
        }

        $paginator = $query->paginate($request->integer('per_page', 50));
        $paginator->getCollection()->transform(
            fn (BookingQuestionPreset $preset) => $this->presetSync->formatPreset($preset)
        );

        return $this->respond($paginator);
    }

    public function show(int $id)
    {
        $preset = BookingQuestionPreset::query()
            ->withCount('services')
            ->with(['questions.options.linkedBookingService'])
            ->findOrFail($id);

        return $this->respond($this->presetSync->formatPreset($preset));
    }

    public function store(Request $request)
    {
        $data = $this->validatePresetPayload($request);

        $preset = DB::transaction(function () use ($data) {
            $preset = BookingQuestionPreset::query()->create([
                'name' => $data['name'],
                'cn_name' => $data['cn_name'] ?? null,
                'is_active' => (bool) ($data['is_active'] ?? true),
            ]);
            $this->presetSync->syncPresetQuestions($preset, $data['questions'] ?? []);

            return $preset->fresh(['questions.options.linkedBookingService']);
        });

        return $this->respond($this->presetSync->formatPreset($preset), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $preset = BookingQuestionPreset::query()->findOrFail($id);
        $data = $this->validatePresetPayload($request, true);

        $preset = DB::transaction(function () use ($preset, $data, $request) {
            $preset->update([
                'name' => $data['name'] ?? $preset->name,
                'cn_name' => array_key_exists('cn_name', $data) ? ($data['cn_name'] ?: null) : $preset->cn_name,
                'is_active' => array_key_exists('is_active', $data)
                    ? (bool) $data['is_active']
                    : $preset->is_active,
            ]);

            if ($request->has('questions')) {
                $this->presetSync->syncPresetQuestions($preset, $data['questions'] ?? []);
                $this->presetSync->syncPresetToAttachedServices($preset->fresh(), true);
            }

            return $preset->fresh(['questions.options.linkedBookingService']);
        });

        $preset->loadCount('services');

        return $this->respond($this->presetSync->formatPreset($preset), 'Updated');
    }

    public function destroy(int $id)
    {
        $preset = BookingQuestionPreset::query()->findOrFail($id);

        DB::transaction(function () use ($preset) {
            $services = $preset->services()
                ->with(['questions.options', 'linkedBookingProduct'])
                ->get();

            foreach ($services as $service) {
                $customs = $this->presetSync->extractCustomQuestionPayloads($service);
                $service->questionPresets()->detach($preset->id);
                $this->presetSync->rematerializeServiceQuestions($service, $customs);
                if ($service->linkedBookingProduct) {
                    $service->load(['questions.options.linkedBookingService', 'categories:id,name,cn_name', 'linkedBookingProduct']);
                    app(\App\Services\Booking\BookingServiceProductLinkService::class)
                        ->syncProductFromService($service, $service->linkedBookingProduct);
                }
            }

            $preset->delete();
        });

        return $this->respond(null, 'Deleted');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePresetPayload(Request $request, bool $partial = false): array
    {
        $rules = [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'cn_name' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'questions' => [$partial ? 'sometimes' : 'nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.cn_description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => [
                'required_with:questions.*.options',
                'integer',
                'exists:booking_services,id',
            ],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options.*.allow_quantity' => ['nullable', 'boolean'],
        ];

        $data = $request->validate($rules);

        if ($request->has('questions')) {
            foreach (($data['questions'] ?? []) as $qi => $question) {
                $options = $question['options'] ?? [];
                if (! is_array($options) || $options === []) {
                    throw ValidationException::withMessages([
                        "questions.{$qi}.options" => ['Each question must have at least one option with a linked booking service.'],
                    ]);
                }
            }
        }

        return $data;
    }
}
