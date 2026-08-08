<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingStaffSchedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Services\Booking\BookingBranchScheduleService;
use App\Services\StoreLocationAccessService;

class StaffScheduleController extends Controller
{
    public function __construct(
        private readonly BookingBranchScheduleService $branchSchedules,
        private readonly StoreLocationAccessService $storeAccess,
    ) {}

    public function index(Request $request)
    {
        $accessibleIds = $this->storeAccess->accessibleStoreLocations($request->user(), true)->pluck('id');
        $query = BookingStaffSchedule::query()->with(['staff:id,name', 'storeLocation:id,name,code,is_active,is_booking_available'])
            ->where(fn ($scope) => $scope->whereIn('store_location_id', $accessibleIds)
                ->when($this->storeAccess->hasPlatformBypass($request->user()), fn ($legacy) => $legacy->orWhereNull('store_location_id')));

        if ($request->filled('branch_store_location_id')) {
            $branch = $this->branchSchedules->authorizeHistoricalBranch($request->user(), $request->integer('branch_store_location_id'));
            $query->where('store_location_id', $branch->id);
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }

        if ($request->has('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        return $this->respond($query->paginate(50));
    }
    public function show(Request $request, int $id) { $item = BookingStaffSchedule::with(['staff:id,name','storeLocation:id,name,code,is_active,is_booking_available'])->findOrFail($id); $this->authorizeRecord($request, $item); return $this->respond($item); }
    public function store(Request $request) {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'day_of_week' => ['required', 'integer', 'between:0,6'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_start' => ['nullable', 'date_format:H:i'],
            'break_end' => ['nullable', 'date_format:H:i'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->branchSchedules->authorizeOperationalBranch($request->user(), (int) $data['store_location_id']);
        $this->branchSchedules->assertStaffAssigned((int) $data['staff_id'], (int) $data['store_location_id']);
        $this->validateScheduleTimes($data['start_time'], $data['end_time'], $data['break_start'] ?? null, $data['break_end'] ?? null);
        $data['is_active'] = $data['is_active'] ?? true;
        $this->branchSchedules->assertScheduleDoesNotOverlap((int) $data['staff_id'], (int) $data['day_of_week'], $data['start_time'], $data['end_time'], (bool) $data['is_active']);
        return $this->respond(BookingStaffSchedule::create($data)->load(['staff:id,name','storeLocation:id,name,code,is_active,is_booking_available']), null, true, 201);
    }
    public function update(Request $request, int $id) {
        $item = BookingStaffSchedule::findOrFail($id);
        $this->authorizeRecord($request, $item);
        $data = $request->validate([
            'staff_id' => ['sometimes', 'integer', 'exists:staffs,id'],
            'store_location_id' => ['sometimes', 'integer', 'exists:store_locations,id'],
            'day_of_week' => ['sometimes', 'integer', 'between:0,6'],
            'start_time' => ['sometimes', 'date_format:H:i'],
            'end_time' => ['sometimes', 'date_format:H:i'],
            'break_start' => ['nullable', 'date_format:H:i'],
            'break_end' => ['nullable', 'date_format:H:i'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $staffId = (int) ($data['staff_id'] ?? $item->staff_id);
        $branchId = (int) ($data['store_location_id'] ?? $item->store_location_id);
        $this->branchSchedules->authorizeHistoricalBranch($request->user(), $branchId);
        $willBeActive = (bool) ($data['is_active'] ?? $item->is_active);
        $isActivating = ! $item->is_active && $willBeActive;
        $isChangingBranch = $branchId !== (int) $item->store_location_id;
        if (($isActivating || $isChangingBranch) && $willBeActive) {
            $this->branchSchedules->authorizeOperationalBranch($request->user(), $branchId);
        }
        $this->branchSchedules->assertStaffAssigned($staffId, $branchId);
        $this->validateScheduleTimes((string) ($data['start_time'] ?? $item->start_time), (string) ($data['end_time'] ?? $item->end_time), $data['break_start'] ?? $item->break_start, $data['break_end'] ?? $item->break_end);
        $this->branchSchedules->assertScheduleDoesNotOverlap($staffId, (int) ($data['day_of_week'] ?? $item->day_of_week), (string) ($data['start_time'] ?? $item->start_time), (string) ($data['end_time'] ?? $item->end_time), $willBeActive, $item->id);
        $item->update($data);
        return $this->respond($item->load(['staff:id,name','storeLocation:id,name,code,is_active,is_booking_available']));
    }

    public function bulkUpdate(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct', 'exists:booking_staff_schedules,id'],
            'start_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'end_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'break_start' => ['sometimes', 'nullable', 'date_format:H:i'],
            'break_end' => ['sometimes', 'nullable', 'date_format:H:i'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $hasStart = array_key_exists('start_time', $data);
        $hasEnd = array_key_exists('end_time', $data);
        $hasBreakStart = array_key_exists('break_start', $data);
        $hasBreakEnd = array_key_exists('break_end', $data);
        $hasIsActive = array_key_exists('is_active', $data);

        if (! $hasStart && ! $hasEnd && ! $hasBreakStart && ! $hasBreakEnd && ! $hasIsActive) {
            return $this->respondError('At least one updatable field is required.', 422);
        }

        if ($hasBreakStart xor $hasBreakEnd) {
            return $this->respondError('break_start and break_end must be provided together.', 422);
        }

        $schedules = BookingStaffSchedule::query()
            ->whereIn('id', $data['ids'])
            ->get();
        foreach ($schedules as $schedule) $this->authorizeRecord($request, $schedule);

        try {
            DB::transaction(function () use ($schedules, $data, $hasStart, $hasEnd, $hasBreakStart, $hasIsActive) {
                foreach ($schedules as $schedule) {
                    $start = $hasStart ? $data['start_time'] : $schedule->start_time;
                    $end = $hasEnd ? $data['end_time'] : $schedule->end_time;
                    $breakStart = $hasBreakStart ? $data['break_start'] : $schedule->break_start;
                    $breakEnd = $hasBreakStart ? $data['break_end'] : $schedule->break_end;

                    if ($this->timeToMinutes((string) $start) >= $this->timeToMinutes((string) $end)) {
                        throw new \InvalidArgumentException('Start time must be earlier than end time.');
                    }

                    if (($breakStart && ! $breakEnd) || (! $breakStart && $breakEnd)) {
                        throw new \InvalidArgumentException('Break start/end must both be set, or both left empty.');
                    }

                    if ($breakStart && $breakEnd) {
                        $breakStartMinutes = $this->timeToMinutes((string) $breakStart);
                        $breakEndMinutes = $this->timeToMinutes((string) $breakEnd);
                        if ($breakStartMinutes >= $breakEndMinutes) {
                            throw new \InvalidArgumentException('Break start must be earlier than break end.');
                        }
                        if ($breakStartMinutes < $this->timeToMinutes((string) $start) || $breakEndMinutes > $this->timeToMinutes((string) $end)) {
                            throw new \InvalidArgumentException('Break range must be within working hours.');
                        }
                    }

                    $willBeActive = $hasIsActive ? (bool) $data['is_active'] : (bool) $schedule->is_active;
                    if (! $schedule->is_active && $willBeActive) {
                        $this->branchSchedules->authorizeOperationalBranch(request()->user(), (int) $schedule->store_location_id);
                    }
                    $this->branchSchedules->assertScheduleDoesNotOverlap((int) $schedule->staff_id, (int) $schedule->day_of_week, (string) $start, (string) $end, $willBeActive, (int) $schedule->id);

                    $payload = [];
                    if ($hasStart) {
                        $payload['start_time'] = $data['start_time'];
                    }
                    if ($hasEnd) {
                        $payload['end_time'] = $data['end_time'];
                    }
                    if ($hasBreakStart) {
                        $payload['break_start'] = $data['break_start'];
                        $payload['break_end'] = $data['break_end'];
                    }
                    if ($hasIsActive) {
                        $payload['is_active'] = (bool) $data['is_active'];
                    }

                    if (! empty($payload)) {
                        $schedule->update($payload);
                    }
                }
            });
        } catch (\InvalidArgumentException $exception) {
            return $this->respondError($exception->getMessage(), 422);
        }

        return $this->respond([
            'updated_count' => $schedules->count(),
        ]);
    }

    private function timeToMinutes(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));
        return ($hour * 60) + $minute;
    }

    private function validateScheduleTimes(string $start, string $end, ?string $breakStart, ?string $breakEnd): void
    {
        if ($this->timeToMinutes($start) >= $this->timeToMinutes($end)) abort(422, 'Start time must be earlier than end time.');
        if (($breakStart && ! $breakEnd) || (! $breakStart && $breakEnd)) abort(422, 'Break start/end must both be set, or both left empty.');
        if ($breakStart && $breakEnd && ($this->timeToMinutes($breakStart) >= $this->timeToMinutes($breakEnd) || $this->timeToMinutes($breakStart) < $this->timeToMinutes($start) || $this->timeToMinutes($breakEnd) > $this->timeToMinutes($end))) abort(422, 'Break range must be valid and within working hours.');
    }

    public function exportCsv(Request $request)
    {
        $rows = BookingStaffSchedule::query()
            ->with(['staff:id,name','storeLocation:id,name,code,is_active,is_booking_available'])
            ->whereIn('store_location_id', $this->storeAccess->accessibleStoreLocations($request->user(), true)->pluck('id'))
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking staff schedules CSV export.'], 500);
        }

        $headers = ['id', 'staff_id', 'staff_name', 'store_location_id', 'branch_code', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end', 'is_active'];
        fputcsv($stream, $headers);

        foreach ($rows as $row) {
            fputcsv($stream, [
                $row->id,
                $row->staff_id,
                optional($row->staff)->name,
                $row->store_location_id,
                optional($row->storeLocation)->code,
                $row->day_of_week,
                substr((string) $row->start_time, 0, 5),
                substr((string) $row->end_time, 0, 5),
                $row->break_start ? substr((string) $row->break_start, 0, 5) : null,
                $row->break_end ? substr((string) $row->break_end, 0, 5) : null,
                $row->is_active ? 'true' : 'false',
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-staff-schedules-export_' . now()->format('Y-m-d_His') . '.csv"',
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
        $allowedHeaders = ['id', 'staff_id', 'store_location_id', 'branch_code', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end', 'is_active', 'staff_name'];
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

            $rawIsActive = $payload['is_active'] ?? 'true';
            $parsedIsActive = filter_var((string) $rawIsActive, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            $validator = Validator::make([
                'staff_id' => $payload['staff_id'] ?? null,
                'store_location_id' => $payload['store_location_id'] ?? null,
                'day_of_week' => $payload['day_of_week'] ?? null,
                'start_time' => $payload['start_time'] ?? null,
                'end_time' => $payload['end_time'] ?? null,
                'break_start' => $payload['break_start'] ?: null,
                'break_end' => $payload['break_end'] ?: null,
                'is_active' => $parsedIsActive ?? true,
            ], [
                'staff_id' => ['required', 'integer', 'exists:staffs,id'],
                'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
                'day_of_week' => ['required', 'integer', 'between:0,6'],
                'start_time' => ['required', 'date_format:H:i'],
                'end_time' => ['required', 'date_format:H:i'],
                'break_start' => ['nullable', 'date_format:H:i'],
                'break_end' => ['nullable', 'date_format:H:i'],
                'is_active' => ['nullable', 'boolean'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $validated['is_active'] = array_key_exists('is_active', $validated)
                ? (bool) $validated['is_active']
                : true;
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            try {
                $record = $id ? BookingStaffSchedule::query()->find($id) : null;
                if ($record) {
                    $this->authorizeRecord($request, $record);
                    $this->branchSchedules->authorizeHistoricalBranch($request->user(), (int) $validated['store_location_id']);
                    $requiresOperationalBranch = (bool) $validated['is_active']
                        && (! $record->is_active || (int) $record->store_location_id !== (int) $validated['store_location_id']);
                    if ($requiresOperationalBranch) {
                        $this->branchSchedules->authorizeOperationalBranch($request->user(), (int) $validated['store_location_id']);
                    }
                } else {
                    // CSV creation follows the same rule as the create form: only operational Branches are accepted.
                    $this->branchSchedules->authorizeOperationalBranch($request->user(), (int) $validated['store_location_id']);
                }
                $this->branchSchedules->assertStaffAssigned((int) $validated['staff_id'], (int) $validated['store_location_id']);
                if (($validated['break_start'] && ! $validated['break_end']) || (! $validated['break_start'] && $validated['break_end'])) {
                    throw new \InvalidArgumentException('Break start/end must both be set, or both left empty.');
                }

                if ($this->timeToMinutes($validated['start_time']) >= $this->timeToMinutes($validated['end_time'])) {
                    throw new \InvalidArgumentException('Start time must be earlier than end time.');
                }

                if ($validated['break_start'] && $validated['break_end']) {
                    $breakStart = $this->timeToMinutes($validated['break_start']);
                    $breakEnd = $this->timeToMinutes($validated['break_end']);
                    if ($breakStart >= $breakEnd) {
                        throw new \InvalidArgumentException('Break start must be earlier than break end.');
                    }
                }

                $this->branchSchedules->assertScheduleDoesNotOverlap((int) $validated['staff_id'], (int) $validated['day_of_week'], $validated['start_time'], $validated['end_time'], (bool) $validated['is_active'], $record?->id);
                if (! $record) {
                    BookingStaffSchedule::query()->create($validated);
                    $summary['created']++;
                } else {
                    $isUnchanged =
                        ((int) $record->staff_id === (int) $validated['staff_id']) &&
                        ((int) $record->day_of_week === (int) $validated['day_of_week']) &&
                        (substr((string) $record->start_time, 0, 5) === $validated['start_time']) &&
                        (substr((string) $record->end_time, 0, 5) === $validated['end_time']) &&
                        (($record->break_start ? substr((string) $record->break_start, 0, 5) : null) === ($validated['break_start'] ?? null)) &&
                        (($record->break_end ? substr((string) $record->break_end, 0, 5) : null) === ($validated['break_end'] ?? null)) &&
                        ((bool) $record->is_active === (bool) $validated['is_active']);
                    if ($isUnchanged) {
                        $summary['skipped']++;
                        continue;
                    }
                    $record->update($validated);
                    $summary['updated']++;
                }
            } catch (\Throwable $throwable) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $throwable->getMessage()];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }
    public function destroy(Request $request, int $id) { $item=BookingStaffSchedule::findOrFail($id); $this->authorizeRecord($request,$item); $item->delete(); return $this->respond(null); }

    private function authorizeRecord(Request $request, BookingStaffSchedule $item): void
    {
        if ($item->store_location_id !== null) $this->branchSchedules->authorizeHistoricalBranch($request->user(), (int) $item->store_location_id);
        elseif (! $this->storeAccess->hasPlatformBypass($request->user())) abort(403, 'Legacy unattributed schedules require platform reconciliation access.');
    }
}
