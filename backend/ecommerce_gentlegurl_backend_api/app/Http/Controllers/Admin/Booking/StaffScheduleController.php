<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingStaffSchedule;
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
    public function destroy(int $id) { BookingStaffSchedule::findOrFail($id)->delete(); return $this->respond(null); }
}
