<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingStaffSchedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class StaffScheduleController extends Controller
{
    public function index(Request $request)
    {
        $query = BookingStaffSchedule::query();

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }

        return $this->respond($query->paginate(50));
    }
    public function show(int $id) { return $this->respond(BookingStaffSchedule::findOrFail($id)); }
    public function store(Request $request) {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'day_of_week' => ['required', 'integer', 'between:0,6'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_start' => ['nullable', 'date_format:H:i'],
            'break_end' => ['nullable', 'date_format:H:i'],
        ]);
        return $this->respond(BookingStaffSchedule::create($data), null, true, 201);
    }
    public function update(Request $request, int $id) {
        $item = BookingStaffSchedule::findOrFail($id);
        $item->update($request->validate([
            'day_of_week' => ['sometimes', 'integer', 'between:0,6'],
            'start_time' => ['sometimes', 'date_format:H:i'],
            'end_time' => ['sometimes', 'date_format:H:i'],
            'break_start' => ['nullable', 'date_format:H:i'],
            'break_end' => ['nullable', 'date_format:H:i'],
        ]));
        return $this->respond($item);
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
        ]);

        $hasStart = array_key_exists('start_time', $data);
        $hasEnd = array_key_exists('end_time', $data);
        $hasBreakStart = array_key_exists('break_start', $data);
        $hasBreakEnd = array_key_exists('break_end', $data);

        if (! $hasStart && ! $hasEnd && ! $hasBreakStart && ! $hasBreakEnd) {
            return $this->respondError('At least one updatable field is required.', 422);
        }

        if ($hasBreakStart xor $hasBreakEnd) {
            return $this->respondError('break_start and break_end must be provided together.', 422);
        }

        $schedules = BookingStaffSchedule::query()
            ->whereIn('id', $data['ids'])
            ->get();

        try {
            DB::transaction(function () use ($schedules, $data, $hasStart, $hasEnd, $hasBreakStart) {
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

    public function exportCsv(Request $request)
    {
        $rows = BookingStaffSchedule::query()
            ->with('staff:id,name')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking staff schedules CSV export.'], 500);
        }

        $headers = ['id', 'staff_id', 'staff_name', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end'];
        fputcsv($stream, $headers);

        foreach ($rows as $row) {
            fputcsv($stream, [
                $row->id,
                $row->staff_id,
                optional($row->staff)->name,
                $row->day_of_week,
                substr((string) $row->start_time, 0, 5),
                substr((string) $row->end_time, 0, 5),
                $row->break_start ? substr((string) $row->break_start, 0, 5) : null,
                $row->break_end ? substr((string) $row->break_end, 0, 5) : null,
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
        $allowedHeaders = ['id', 'staff_id', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end', 'staff_name'];
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

            $validator = Validator::make([
                'staff_id' => $payload['staff_id'] ?? null,
                'day_of_week' => $payload['day_of_week'] ?? null,
                'start_time' => $payload['start_time'] ?? null,
                'end_time' => $payload['end_time'] ?? null,
                'break_start' => $payload['break_start'] ?: null,
                'break_end' => $payload['break_end'] ?: null,
            ], [
                'staff_id' => ['required', 'integer', 'exists:staffs,id'],
                'day_of_week' => ['required', 'integer', 'between:0,6'],
                'start_time' => ['required', 'date_format:H:i'],
                'end_time' => ['required', 'date_format:H:i'],
                'break_start' => ['nullable', 'date_format:H:i'],
                'break_end' => ['nullable', 'date_format:H:i'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            try {
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

                $record = $id ? BookingStaffSchedule::query()->find($id) : null;
                if (! $record) {
                    BookingStaffSchedule::query()->create($validated);
                    $summary['created']++;
                } else {
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
    public function destroy(int $id) { BookingStaffSchedule::findOrFail($id)->delete(); return $this->respond(null); }
}
