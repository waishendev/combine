<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingQuestionPreset;
use App\Models\Booking\BookingService;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuestionPresetController extends Controller
{
    public function __construct(private readonly StoreLocationAccessService $storeLocationAccess) {}

    public function index(Request $request)
    {
        $query = BookingQuestionPreset::query()->withCount('questions')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%' . trim((string) $request->input('search')) . '%';
                $query->where(fn ($q) => $q->where('name', 'ilike', $term)
                    ->orWhereHas('questions', fn ($questions) => $questions->where('title', 'ilike', $term)->orWhere('cn_title', 'ilike', $term)));
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $active = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($active !== null) $query->where('is_active', $active);
            })->latest('updated_at');

        return $this->respond($request->boolean('all')
            ? $query->limit(min(500, max(1, $request->integer('limit', 200))))->get()
            : $query->paginate(min(100, max(1, $request->integer('per_page', 20))))) ;
    }

    public function show(Request $request, BookingQuestionPreset $questionPreset)
    {
        $questionPreset->load(['questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price,is_active'])->loadCount('questions');
        $accessibleServiceIds = BookingService::query()
            ->whereHas('storeLocations', fn ($q) => $q->whereIn(
                'store_locations.id',
                $this->storeLocationAccess->accessibleStoreLocations($request->user(), false)->pluck('id')
            ))->pluck('id')->map(fn ($id) => (int) $id)->flip();
        $questionPreset->questions->each(fn ($question) => $question->options->each(function ($option) use ($accessibleServiceIds): void {
            if ($option->linked_booking_service_id && ! $accessibleServiceIds->has((int) $option->linked_booking_service_id)) {
                $option->setAttribute('linked_booking_service_id', null);
                $option->setRelation('linkedBookingService', null);
            }
        }));

        return $this->respond($questionPreset);
    }

    public function store(Request $request)
    {
        $preset = DB::transaction(fn () => $this->persist(new BookingQuestionPreset(), $this->validated($request)));
        return $this->respond($preset, 'Question preset created.', true, 201);
    }

    public function update(Request $request, BookingQuestionPreset $questionPreset)
    {
        $preset = DB::transaction(fn () => $this->persist($questionPreset, $this->validated($request)));
        return $this->respond($preset, 'Question preset updated.');
    }

    public function destroy(BookingQuestionPreset $questionPreset)
    {
        $questionPreset->delete();
        return $this->respond(null, 'Question preset deleted.');
    }

    private function validated(Request $request): array
    {
        // Accept the V1 single-question payload while all current clients move to questions[].
        if (! $request->has('questions') && $request->filled('title')) {
            $request->merge(['questions' => [[
                'title' => $request->input('title'), 'cn_title' => $request->input('cn_title'),
                'description' => $request->input('description'), 'cn_description' => $request->input('cn_description'),
                'question_type' => $request->input('question_type', 'single_choice'),
                'is_required' => $request->boolean('is_required'), 'is_active' => $request->boolean('is_active', true),
                'options' => $request->input('options', []),
            ]]]);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'], 'is_active' => ['nullable', 'boolean'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.title' => ['required', 'string', 'max:255'],
            'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'], 'questions.*.cn_description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required', Rule::in(['single_choice', 'multi_choice'])],
            'questions.*.is_required' => ['nullable', 'boolean'], 'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['required', 'array', 'min:1'],
            'questions.*.options.*.label' => ['required', 'string', 'max:255'],
            'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['nullable', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options.*.allow_quantity' => ['nullable', 'boolean'],
        ]);

        $linkedIds = collect($data['questions'])->flatMap(fn ($q) => $q['options'])
            ->pluck('linked_booking_service_id')->filter()->map(fn ($id) => (int) $id)->unique()->values();
        if ($linkedIds->isNotEmpty()) {
            $accessibleLocationIds = $this->storeLocationAccess->accessibleStoreLocations($request->user(), false)->pluck('id');
            $allowedIds = BookingService::query()->whereIn('id', $linkedIds)
                ->whereHas('storeLocations', fn ($q) => $q->whereIn('store_locations.id', $accessibleLocationIds))
                ->pluck('id')->map(fn ($id) => (int) $id);
            if ($allowedIds->count() !== $linkedIds->count()) {
                throw ValidationException::withMessages(['questions' => 'A linked Booking Service is outside your accessible business or Branch scope.']);
            }
        }
        return $data;
    }

    private function persist(BookingQuestionPreset $preset, array $data): BookingQuestionPreset
    {
        $questions = $data['questions'];
        $first = $questions[0];
        $preset->fill([
            'name' => trim($data['name']), 'is_active' => (bool) ($data['is_active'] ?? true),
            // Keep V1 columns populated for rollback/backward compatibility.
            'title' => $first['title'], 'cn_title' => $first['cn_title'] ?? null,
            'description' => $first['description'] ?? null, 'cn_description' => $first['cn_description'] ?? null,
            'question_type' => $first['question_type'], 'is_required' => (bool) ($first['is_required'] ?? false),
        ])->save();
        $preset->questions()->delete();
        $preset->options()->delete();
        foreach ($questions as $questionIndex => $questionData) {
            $options = $questionData['options']; unset($questionData['options']);
            $question = $preset->questions()->create($questionData + ['sort_order' => $questionIndex]);
            foreach ($options as $optionIndex => $option) {
                $question->options()->create([
                    'booking_question_preset_id' => $preset->id, 'label' => trim($option['label']),
                    'cn_label' => trim((string) ($option['cn_label'] ?? '')) ?: null,
                    'linked_booking_service_id' => $option['linked_booking_service_id'] ?? null,
                    'sort_order' => $optionIndex, 'is_active' => (bool) ($option['is_active'] ?? true),
                    'allow_quantity' => (bool) ($option['allow_quantity'] ?? true),
                ]);
            }
        }
        return $preset->load(['questions.options.linkedBookingService'])->loadCount('questions');
    }
}
