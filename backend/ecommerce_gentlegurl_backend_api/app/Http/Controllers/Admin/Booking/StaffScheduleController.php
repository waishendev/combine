<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingStaffSchedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

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
    public function destroy(int $id) { BookingStaffSchedule::findOrFail($id)->delete(); return $this->respond(null); }
}
