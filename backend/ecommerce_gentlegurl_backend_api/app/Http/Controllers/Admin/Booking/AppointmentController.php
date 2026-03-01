<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPhoto;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Booking::query()->with(['service', 'staff', 'customer']);

        if ($request->filled('date')) {
            $query->whereDate('start_at', $request->string('date'));
        }
        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return $this->respond($query->orderBy('start_at')->paginate($request->integer('per_page', 20)));
    }

    public function show(int $id)
    {
        $booking = Booking::with(['service', 'staff', 'customer'])->findOrFail($id);
        return $this->respond($booking);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:COMPLETED,CANCELLED,LATE_CANCELLATION,NO_SHOW,CONFIRMED'],
            'notes' => ['nullable', 'string'],
        ]);

        $booking = Booking::findOrFail($id);
        $status = $validated['status'];
        $allowed = ['COMPLETED', 'CANCELLED', 'LATE_CANCELLATION', 'NO_SHOW'];

        if ($booking->status === 'CONFIRMED' && !in_array($status, $allowed, true)) {
            return $this->respondError('Invalid status transition from CONFIRMED.', 422);
        }

        $booking->status = $status;
        if (in_array($status, ['CANCELLED', 'LATE_CANCELLATION'], true)) {
            $booking->cancelled_at = now();
            $booking->cancellation_type = $status;
        }
        if (!empty($validated['notes'])) {
            $booking->notes = $validated['notes'];
        }
        $booking->save();

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => 'ADMIN',
            'actor_id' => optional($request->user())->id,
            'action' => 'UPDATE_STATUS',
            'meta' => ['status' => $status],
            'created_at' => now(),
        ]);

        return $this->respond($booking);
    }

    public function uploadPhoto(Request $request, int $id)
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
            'uploaded_by_staff_id' => ['required', 'integer', 'exists:staffs,id'],
        ]);

        Booking::findOrFail($id);
        $photo = BookingPhoto::create([
            'booking_id' => $id,
            'url' => $validated['url'],
            'uploaded_by_staff_id' => $validated['uploaded_by_staff_id'],
            'created_at' => now(),
        ]);

        BookingLog::create([
            'booking_id' => $id,
            'actor_type' => 'STAFF',
            'actor_id' => $validated['uploaded_by_staff_id'],
            'action' => 'UPLOAD_PHOTO',
            'meta' => ['url' => $validated['url']],
            'created_at' => now(),
        ]);

        return $this->respond($photo);
    }
}
