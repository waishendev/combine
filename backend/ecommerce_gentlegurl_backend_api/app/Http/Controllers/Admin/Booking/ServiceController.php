<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServicePrimarySlot;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionOption;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index()
    {
        $services = BookingService::query()
            ->with(['allowedStaffs:id,name', 'primarySlots', 'questions.options.linkedBookingService:id,name,duration_min,service_price'])
            ->latest()
            ->paginate(20);

        $services->getCollection()->transform(fn (BookingService $service) => $this->formatService($service));

        return $this->respond($services);
    }

    public function show(int $id)
    {
        $service = BookingService::query()
            ->with(['allowedStaffs:id,name,position,avatar_path', 'primarySlots', 'questions.options.linkedBookingService:id,name,duration_min,service_price'])
            ->findOrFail($id);

        return $this->respond($this->formatService($service));
    }

    public function store(Request $request)
    {
        if ($request->filled('questions_json') && ! $request->filled('questions')) {
            $decoded = json_decode((string) $request->input('questions_json'), true);
            if (is_array($decoded)) {
                $request->merge(['questions' => $decoded]);
            }
        }

        $data = $request->validate([
            'name' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['nullable', 'numeric', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'duration_min' => ['required', 'integer', 'min:1'],
            'deposit_amount' => ['required', 'numeric', 'min:0'],
            'buffer_min' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'rules_json' => ['nullable', 'array'],
            'allowed_staff_ids' => ['required', 'array', 'min:1'],
            'allowed_staff_ids.*' => ['integer', 'distinct'],
            'primary_slots' => ['nullable', 'array'],
            'primary_slots.*' => ['date_format:H:i'],
            'questions' => ['nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions_json' => ['nullable', 'string'],
        ]);
        $data['service_price'] = $data['service_price'] ?? 0;
        $data['price'] = $data['price'] ?? $data['service_price'];
        $data['is_package_eligible'] = (bool) ($data['is_package_eligible'] ?? true);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $allowedStaffIds = $this->resolveAllowedStaffIds($data['allowed_staff_ids'] ?? []);
        $primarySlots = $data['primary_slots'] ?? [];
        $questions = $data['questions'] ?? [];
        unset($data['allowed_staff_ids'], $data['primary_slots'], $data['questions'], $data['questions_json']);

        $service = BookingService::create($data);
        $this->syncAllowedStaffs($service, $allowedStaffIds);
        $this->syncPrimarySlots($service, $primarySlots);
        $this->syncQuestions($service, $questions);

        BookingLog::create(['actor_type' => 'ADMIN', 'actor_id' => optional($request->user())->id, 'action' => 'UPDATE_SERVICE', 'meta' => ['service_id' => $service->id], 'created_at' => now()]);
        return $this->respond($this->formatService($service->fresh(['allowedStaffs:id,name,position,avatar_path', 'primarySlots', 'questions.options.linkedBookingService:id,name,duration_min,service_price'])), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        if ($request->filled('questions_json') && ! $request->filled('questions')) {
            $decoded = json_decode((string) $request->input('questions_json'), true);
            if (is_array($decoded)) {
                $request->merge(['questions' => $decoded]);
            }
        }

        $service = BookingService::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['sometimes', 'numeric', 'min:0'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'is_package_eligible' => ['sometimes', 'boolean'],
            'duration_min' => ['sometimes', 'integer', 'min:1'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'buffer_min' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'rules_json' => ['nullable', 'array'],
            'allowed_staff_ids' => ['required', 'array', 'min:1'],
            'allowed_staff_ids.*' => ['integer', 'distinct'],
            'primary_slots' => ['nullable', 'array'],
            'primary_slots.*' => ['date_format:H:i'],
            'questions' => ['nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions_json' => ['nullable', 'string'],
        ]);

        $oldImagePath = $service->image_path;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $allowedStaffIds = $this->resolveAllowedStaffIds($data['allowed_staff_ids'] ?? []);
        $primarySlots = $data['primary_slots'] ?? [];
        $questions = $data['questions'] ?? [];
        unset($data['allowed_staff_ids'], $data['primary_slots'], $data['questions'], $data['questions_json']);

        $service->update($data);
        $this->syncAllowedStaffs($service, $allowedStaffIds);
        $this->syncPrimarySlots($service, $primarySlots);
        $this->syncQuestions($service, $questions);

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        BookingLog::create(['actor_type' => 'ADMIN', 'actor_id' => optional($request->user())->id, 'action' => 'UPDATE_SERVICE', 'meta' => ['service_id' => $service->id], 'created_at' => now()]);
        return $this->respond($this->formatService($service->fresh(['allowedStaffs:id,name,position,avatar_path', 'primarySlots', 'questions.options.linkedBookingService:id,name,duration_min,service_price'])));
    }

    public function destroy(int $id)
    {
        $service = BookingService::findOrFail($id);
        $service->delete();
        return $this->respond(null);
    }

    private function resolveAllowedStaffIds(array $staffIds): array
    {
        $ids = collect($staffIds)->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values();

        if ($ids->isEmpty()) {
            abort(response()->json([
                'success' => false,
                'message' => 'At least one allowed staff is required.',
                'data' => [
                    'errors' => [
                        'allowed_staff_ids' => ['At least one allowed staff is required.'],
                    ],
                ],
            ], 422));
        }

        $validIds = Staff::query()
            ->whereIn('id', $ids->all())
            ->where('is_active', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($validIds->count() !== $ids->count()) {
            abort(response()->json([
                'success' => false,
                'message' => 'Allowed staffs must be active staffs.',
                'data' => [
                    'errors' => [
                        'allowed_staff_ids' => ['Allowed staffs must be active staffs.'],
                    ],
                ],
            ], 422));
        }

        return $validIds->all();
    }

    private function syncAllowedStaffs(BookingService $service, array $allowedStaffIds): void
    {
        BookingServiceStaff::query()
            ->where('service_id', $service->id)
            ->whereNotIn('staff_id', $allowedStaffIds)
            ->delete();

        foreach ($allowedStaffIds as $staffId) {
            BookingServiceStaff::query()->updateOrCreate(
                ['service_id' => $service->id, 'staff_id' => $staffId],
                ['is_active' => true]
            );
        }
    }

    private function syncPrimarySlots(BookingService $service, array $primarySlots): void
    {
        BookingServicePrimarySlot::query()->where('booking_service_id', $service->id)->delete();

        $normalized = collect($primarySlots)
            ->map(fn ($time) => substr((string) $time, 0, 5))
            ->filter(fn ($time) => preg_match('/^\d{2}:\d{2}$/', $time) === 1)
            ->unique()
            ->values();

        foreach ($normalized as $index => $time) {
            BookingServicePrimarySlot::query()->create([
                'booking_service_id' => $service->id,
                'start_time' => $time . ':00',
                'sort_order' => $index,
                'is_active' => true,
            ]);
        }
    }

    private function syncQuestions(BookingService $service, array $questions): void
    {
        BookingServiceQuestion::query()->where('booking_service_id', $service->id)->delete();
        $linkedServiceIds = collect($questions)
            ->flatMap(fn ($questionPayload) => $questionPayload['options'] ?? [])
            ->map(fn ($optionPayload) => (int) ($optionPayload['linked_booking_service_id'] ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $linkedServices = BookingService::query()
            ->whereIn('id', $linkedServiceIds)
            ->get(['id', 'name', 'duration_min', 'service_price'])
            ->keyBy('id');

        foreach ($questions as $index => $questionPayload) {
            $question = BookingServiceQuestion::query()->create([
                'booking_service_id' => $service->id,
                'title' => (string) ($questionPayload['title'] ?? ''),
                'description' => $questionPayload['description'] ?? null,
                'question_type' => (string) ($questionPayload['question_type'] ?? 'single_choice'),
                // Order is defined by the request array; ignore client-provided sort_order values.
                'sort_order' => $index,
                'is_required' => (bool) ($questionPayload['is_required'] ?? false),
                'is_active' => (bool) ($questionPayload['is_active'] ?? true),
            ]);

            foreach (($questionPayload['options'] ?? []) as $optionIndex => $optionPayload) {
                $linkedServiceId = (int) ($optionPayload['linked_booking_service_id'] ?? 0);
                $linkedService = $linkedServiceId > 0 ? $linkedServices->get($linkedServiceId) : null;
                $question->options()->create([
                    'label' => trim((string) ($optionPayload['label'] ?? '')) ?: (string) optional($linkedService)->name,
                    'linked_booking_service_id' => $linkedServiceId ?: null,
                    'extra_duration_min' => $linkedService ? (int) $linkedService->duration_min : max(0, (int) ($optionPayload['extra_duration_min'] ?? 0)),
                    'extra_price' => $linkedService ? max(0, (float) $linkedService->service_price) : max(0, (float) ($optionPayload['extra_price'] ?? 0)),
                    'sort_order' => $optionIndex,
                    'is_active' => (bool) ($optionPayload['is_active'] ?? true),
                ]);
            }
        }
    }

    private function formatService(BookingService $service): array
    {
        $allowedStaffs = $service->allowedStaffs
            ->sortBy('name')
            ->values()
            ->map(fn (Staff $staff) => [
                'id' => (int) $staff->id,
                'name' => $staff->name,
                'position' => $staff->position,
                'avatar_path' => $staff->avatar_path,
                'avatar_url' => $staff->avatar_url,
            ])
            ->all();

        $primarySlots = $service->primarySlots
            ->where('is_active', true)
            ->sortBy('sort_order')
            ->values()
            ->map(fn (BookingServicePrimarySlot $slot) => [
                'id' => (int) $slot->id,
                'start_time' => substr((string) $slot->start_time, 0, 5),
                'sort_order' => (int) $slot->sort_order,
                'is_active' => (bool) $slot->is_active,
            ])
            ->all();

        return array_merge($service->toArray(), [
            'allowed_staffs' => $allowedStaffs,
            'allowed_staff_ids' => array_map(fn (array $staff) => (int) $staff['id'], $allowedStaffs),
            'allowed_staff_count' => count($allowedStaffs),
            'allowed_staff_names' => collect($allowedStaffs)->pluck('name')->filter()->values()->all(),
            'questions' => $service->questions
                ->sortBy('sort_order')
                ->values()
                ->map(fn (BookingServiceQuestion $question) => [
                    'id' => (int) $question->id,
                    'title' => (string) $question->title,
                    'description' => $question->description,
                    'question_type' => (string) $question->question_type,
                    'sort_order' => (int) $question->sort_order,
                    'is_required' => (bool) $question->is_required,
                    'is_active' => (bool) $question->is_active,
                    'options' => $question->options->sortBy('sort_order')->values()->map(fn ($option) => $this->formatQuestionOption($option))->all(),
                ])->all(),
            'primary_slots' => $primarySlots,
        ]);
    }

    private function formatQuestionOption(BookingServiceQuestionOption $option): array
    {
        $linkedService = $option->linkedBookingService;
        $extraDuration = $linkedService ? (int) $linkedService->duration_min : (int) $option->extra_duration_min;
        $extraPrice = $linkedService ? (float) $linkedService->service_price : (float) $option->extra_price;

        return [
            'id' => (int) $option->id,
            'label' => trim((string) $option->label) !== '' ? (string) $option->label : (string) optional($linkedService)->name,
            'linked_booking_service_id' => $option->linked_booking_service_id ? (int) $option->linked_booking_service_id : null,
            'extra_duration_min' => $extraDuration,
            'extra_price' => $extraPrice,
            'sort_order' => (int) $option->sort_order,
            'is_active' => (bool) $option->is_active,
        ];
    }
}
