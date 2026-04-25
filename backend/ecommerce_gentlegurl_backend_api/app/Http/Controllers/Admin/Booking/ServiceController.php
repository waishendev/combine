<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServicePrimarySlot;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionOption;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 20);
        $perPage = max(1, min(200, $perPage));

        $services = BookingService::query()
            ->with(['allowedStaffs:id,name', 'primarySlots', 'questions.options.linkedBookingService:id,name,duration_min,service_price'])
            ->latest()
            ->paginate($perPage);

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
            'price_mode' => ['nullable', 'in:fixed,range'],
            'price_range_min' => ['nullable', 'numeric', 'min:0'],
            'price_range_max' => ['nullable', 'numeric', 'min:0'],
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
        $data['price_mode'] = $data['price_mode'] ?? 'fixed';
        if ($data['price_mode'] === 'range') {
            $data['price_range_min'] = $data['price_range_min'] ?? 0;
            $data['price_range_max'] = $data['price_range_max'] ?? 0;
        } else {
            $data['price_range_min'] = null;
            $data['price_range_max'] = null;
        }
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
            'price_mode' => ['sometimes', 'in:fixed,range'],
            'price_range_min' => ['nullable', 'numeric', 'min:0'],
            'price_range_max' => ['nullable', 'numeric', 'min:0'],
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

        if (array_key_exists('price_mode', $data)) {
            if ($data['price_mode'] === 'range') {
                $data['price_range_min'] = $data['price_range_min'] ?? 0;
                $data['price_range_max'] = $data['price_range_max'] ?? 0;
            } else {
                $data['price_range_min'] = null;
                $data['price_range_max'] = null;
            }
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
    
        if (Booking::query()->where('service_id', $id)->exists()) {
            return $this->respondError(
                'This service cannot be deleted because it is already used in existing bookings. Please set it to inactive instead.',
                422
            );
        }
    
        $service->delete();
    
        return $this->respond(null);
    }

    public function exportCsv(Request $request)
    {
        $services = BookingService::query()
            ->with(['allowedStaffs:id', 'primarySlots', 'questions.options'])
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking services CSV export.'], 500);
        }

        $headers = [
            'id', 'name', 'service_type', 'description', 'duration_min', 'service_price', 'deposit_amount', 'buffer_min',
            'price_mode', 'price_range_min', 'price_range_max', 'is_package_eligible', 'is_active', 'allowed_staff_ids', 'primary_slots', 'questions_json',
        ];
        fputcsv($stream, $headers);

        foreach ($services as $service) {
            fputcsv($stream, [
                $service->id,
                $service->name,
                $service->service_type,
                $service->description,
                $service->duration_min,
                $service->service_price,
                $service->deposit_amount,
                $service->buffer_min,
                $service->price_mode,
                $service->price_range_min,
                $service->price_range_max,
                $service->is_package_eligible ? 'true' : 'false',
                $service->is_active ? 'true' : 'false',
                $service->allowedStaffs->pluck('id')->join('|'),
                $service->primarySlots->pluck('start_time')->map(fn ($time) => substr((string) $time, 0, 5))->join('|'),
                json_encode(
                    $service->questions
                        ->sortBy('sort_order')
                        ->values()
                        ->map(fn (BookingServiceQuestion $question) => [
                            'title' => (string) $question->title,
                            'description' => $question->description,
                            'question_type' => (string) $question->question_type,
                            'is_required' => (bool) $question->is_required,
                            'is_active' => (bool) $question->is_active,
                            'options' => $question->options
                                ->sortBy('sort_order')
                                ->values()
                                ->map(fn (BookingServiceQuestionOption $option) => [
                                    'label' => (string) ($option->label ?? ''),
                                    'linked_booking_service_id' => (int) ($option->linked_booking_service_id ?? 0),
                                    'extra_duration_min' => (int) ($option->extra_duration_min ?? 0),
                                    'extra_price' => (float) ($option->extra_price ?? 0),
                                    'is_active' => (bool) $option->is_active,
                                ])
                                ->all(),
                        ])
                        ->all(),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                ),
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-services-export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to open CSV file.'], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json(['message' => 'Invalid CSV header row.'], 422);
        }

        $headers = array_map(fn ($header) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)), $headers);
        $allowedHeaders = [
            'id', 'name', 'service_type', 'description', 'duration_min', 'service_price', 'deposit_amount', 'buffer_min',
            'price_mode', 'price_range_min', 'price_range_max', 'is_package_eligible', 'is_active', 'allowed_staff_ids', 'primary_slots', 'questions_json',
        ];
        $unknownHeaders = array_values(array_diff(array_filter($headers), $allowedHeaders));
        if (! empty($unknownHeaders)) {
            fclose($handle);
            return response()->json(['message' => 'Unexpected CSV headers: ' . implode(', ', $unknownHeaders)], 422);
        }

        $summary = ['totalRows' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0, 'failed' => 0, 'failedRows' => []];
        $rowNumber = 1;

        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $payload = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $payload[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            $isAllEmpty = count(array_filter($payload, fn ($value) => $value !== '')) === 0;
            if ($isAllEmpty) {
                continue;
            }

            $summary['totalRows']++;
            $allowedStaffIds = collect(explode('|', (string) ($payload['allowed_staff_ids'] ?? '')))
                ->map(fn ($id) => (int) trim($id))
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all();
            $primarySlots = collect(explode('|', (string) ($payload['primary_slots'] ?? '')))
                ->map(fn ($time) => trim($time))
                ->filter()
                ->unique()
                ->values()
                ->all();
            $questionsPayload = [];
            if (isset($payload['questions_json']) && trim((string) $payload['questions_json']) !== '') {
                $decodedQuestions = json_decode((string) $payload['questions_json'], true);
                if (! is_array($decodedQuestions)) {
                    $summary['failed']++;
                    $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => 'questions_json must be valid JSON array.'];
                    continue;
                }
                $questionsPayload = $decodedQuestions;
            }

            $raw = [
                'name' => $payload['name'] ?? null,
                'service_type' => $payload['service_type'] ?? null,
                'description' => $payload['description'] ?? null,
                'duration_min' => $payload['duration_min'] ?? null,
                'service_price' => $payload['service_price'] ?? null,
                'deposit_amount' => $payload['deposit_amount'] ?? null,
                'buffer_min' => $payload['buffer_min'] ?? null,
                'price_mode' => $payload['price_mode'] ?: 'fixed',
                'price_range_min' => $payload['price_range_min'] ?: null,
                'price_range_max' => $payload['price_range_max'] ?: null,
                'is_package_eligible' => $payload['is_package_eligible'] ?? 'true',
                'is_active' => $payload['is_active'] ?? 'true',
                'allowed_staff_ids' => $allowedStaffIds,
                'primary_slots' => $primarySlots,
                'questions' => $questionsPayload,
            ];

            $raw['is_active'] = filter_var((string) $raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $raw['is_package_eligible'] = filter_var((string) $raw['is_package_eligible'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:255'],
                'service_type' => ['required', 'in:premium,standard'],
                'description' => ['nullable', 'string'],
                'duration_min' => ['required', 'integer', 'min:1'],
                'service_price' => ['required', 'numeric', 'min:0'],
                'deposit_amount' => ['required', 'numeric', 'min:0'],
                'buffer_min' => ['nullable', 'integer', 'min:0'],
                'price_mode' => ['required', 'in:fixed,range'],
                'price_range_min' => ['nullable', 'numeric', 'min:0'],
                'price_range_max' => ['nullable', 'numeric', 'min:0'],
                'is_package_eligible' => ['required', 'boolean'],
                'is_active' => ['required', 'boolean'],
                'allowed_staff_ids' => ['required', 'array', 'min:1'],
                'allowed_staff_ids.*' => ['integer', 'exists:staffs,id'],
                'primary_slots' => ['nullable', 'array'],
                'primary_slots.*' => ['date_format:H:i'],
                'questions' => ['nullable', 'array'],
                'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
                'questions.*.description' => ['nullable', 'string'],
                'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
                'questions.*.is_required' => ['nullable', 'boolean'],
                'questions.*.is_active' => ['nullable', 'boolean'],
                'questions.*.options' => ['nullable', 'array'],
                'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
                'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
                'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
                'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
                'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $serviceId = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            try {
                DB::transaction(function () use ($serviceId, $validated, &$summary) {
                    $service = $serviceId ? BookingService::query()->find($serviceId) : null;
                    if (! $service) {
                        $service = BookingService::query()->create([
                            'name' => $validated['name'],
                            'service_type' => $validated['service_type'],
                            'description' => $validated['description'] ?? null,
                            'service_price' => $validated['service_price'],
                            'price' => $validated['service_price'],
                            'price_mode' => $validated['price_mode'],
                            'price_range_min' => $validated['price_mode'] === 'range' ? ($validated['price_range_min'] ?? 0) : null,
                            'price_range_max' => $validated['price_mode'] === 'range' ? ($validated['price_range_max'] ?? 0) : null,
                            'is_package_eligible' => $validated['is_package_eligible'],
                            'duration_min' => $validated['duration_min'],
                            'deposit_amount' => $validated['deposit_amount'],
                            'buffer_min' => $validated['buffer_min'] ?? 0,
                            'is_active' => $validated['is_active'],
                        ]);
                        $summary['created']++;
                    } else {
                        $incomingAllowed = collect($validated['allowed_staff_ids'])->map(fn ($id) => (int) $id)->sort()->values()->all();
                        $currentAllowed = $service->allowedStaffs()->pluck('staffs.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                        $incomingSlots = collect($validated['primary_slots'] ?? [])->map(fn ($time) => substr((string) $time, 0, 5))->sort()->values()->all();
                        $currentSlots = $service->primarySlots()->pluck('start_time')->map(fn ($time) => substr((string) $time, 0, 5))->sort()->values()->all();
                        $incomingQuestions = collect($validated['questions'] ?? [])
                            ->map(function ($question) {
                                $options = collect($question['options'] ?? [])
                                    ->map(fn ($option) => [
                                        'label' => trim((string) ($option['label'] ?? '')),
                                        'linked_booking_service_id' => (int) ($option['linked_booking_service_id'] ?? 0),
                                        'extra_duration_min' => max(0, (int) ($option['extra_duration_min'] ?? 0)),
                                        'extra_price' => max(0, (float) ($option['extra_price'] ?? 0)),
                                        'is_active' => (bool) ($option['is_active'] ?? true),
                                    ])
                                    ->values()
                                    ->all();

                                return [
                                    'title' => trim((string) ($question['title'] ?? '')),
                                    'description' => $question['description'] ?? null,
                                    'question_type' => (string) ($question['question_type'] ?? 'single_choice'),
                                    'is_required' => (bool) ($question['is_required'] ?? false),
                                    'is_active' => (bool) ($question['is_active'] ?? true),
                                    'options' => $options,
                                ];
                            })
                            ->values()
                            ->all();
                        $currentQuestions = $service->questions()
                            ->with('options')
                            ->orderBy('sort_order')
                            ->get()
                            ->map(function (BookingServiceQuestion $question) {
                                return [
                                    'title' => trim((string) $question->title),
                                    'description' => $question->description,
                                    'question_type' => (string) $question->question_type,
                                    'is_required' => (bool) $question->is_required,
                                    'is_active' => (bool) $question->is_active,
                                    'options' => $question->options
                                        ->sortBy('sort_order')
                                        ->values()
                                        ->map(fn (BookingServiceQuestionOption $option) => [
                                            'label' => trim((string) ($option->label ?? '')),
                                            'linked_booking_service_id' => (int) ($option->linked_booking_service_id ?? 0),
                                            'extra_duration_min' => max(0, (int) ($option->extra_duration_min ?? 0)),
                                            'extra_price' => max(0, (float) ($option->extra_price ?? 0)),
                                            'is_active' => (bool) $option->is_active,
                                        ])
                                        ->all(),
                                ];
                            })
                            ->values()
                            ->all();
                        $isUnchanged =
                            ($service->name === $validated['name']) &&
                            ($service->service_type === $validated['service_type']) &&
                            (($service->description ?? null) === ($validated['description'] ?? null)) &&
                            ((int) $service->duration_min === (int) $validated['duration_min']) &&
                            ((float) $service->service_price === (float) $validated['service_price']) &&
                            ((float) $service->deposit_amount === (float) $validated['deposit_amount']) &&
                            ((int) $service->buffer_min === (int) ($validated['buffer_min'] ?? 0)) &&
                            ((bool) $service->is_active === (bool) $validated['is_active']) &&
                            ((bool) $service->is_package_eligible === (bool) $validated['is_package_eligible']) &&
                            ($service->price_mode === $validated['price_mode']) &&
                            ((float) ($service->price_range_min ?? 0) === (float) ($validated['price_range_min'] ?? 0)) &&
                            ((float) ($service->price_range_max ?? 0) === (float) ($validated['price_range_max'] ?? 0)) &&
                            ($incomingAllowed === $currentAllowed) &&
                            ($incomingSlots === $currentSlots) &&
                            ($incomingQuestions === $currentQuestions);
                        if ($isUnchanged) {
                            $summary['skipped']++;
                            return;
                        }
                        $service->update([
                            'name' => $validated['name'],
                            'service_type' => $validated['service_type'],
                            'description' => $validated['description'] ?? null,
                            'service_price' => $validated['service_price'],
                            'price' => $validated['service_price'],
                            'price_mode' => $validated['price_mode'],
                            'price_range_min' => $validated['price_mode'] === 'range' ? ($validated['price_range_min'] ?? 0) : null,
                            'price_range_max' => $validated['price_mode'] === 'range' ? ($validated['price_range_max'] ?? 0) : null,
                            'is_package_eligible' => $validated['is_package_eligible'],
                            'duration_min' => $validated['duration_min'],
                            'deposit_amount' => $validated['deposit_amount'],
                            'buffer_min' => $validated['buffer_min'] ?? 0,
                            'is_active' => $validated['is_active'],
                        ]);
                        $summary['updated']++;
                    }

                    $this->syncAllowedStaffs($service, $this->resolveAllowedStaffIds($validated['allowed_staff_ids']));
                    $this->syncPrimarySlots($service, $validated['primary_slots'] ?? []);
                    $this->syncQuestions($service, $validated['questions'] ?? []);
                });
            } catch (\Throwable $throwable) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $throwable->getMessage()];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
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
