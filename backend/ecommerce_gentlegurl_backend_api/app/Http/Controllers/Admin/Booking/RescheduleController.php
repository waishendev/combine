<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Services\Booking\BookingAvailabilityService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class RescheduleController extends Controller
{
    public function __construct(private readonly BookingAvailabilityService $availabilityService)
    {
    }

    public function store(Request $request, int $id)
    {
        $validated = $request->validate([
            'start_at' => ['required', 'date'],
            'reason' => ['nullable', 'string'],
        ]);

        $booking = Booking::with('service')->findOrFail($id);
        $newStart = Carbon::parse($validated['start_at']);
        $newEnd = $newStart->copy()->addMinutes((int) $booking->service->duration_min);

        if ($this->availabilityService->hasConflict((int) $booking->staff_id, $newStart, $newEnd, (int) $booking->buffer_min)) {
            return $this->respondError('Selected slot is not available.', 409);
        }

        $oldStart = $booking->start_at;
        $oldEnd = $booking->end_at;
        $booking->update([
            'start_at' => $newStart,
            'end_at' => $newEnd,
            'reschedule_count' => min(1, (int) ($booking->reschedule_count ?? 0) + 1),
            'rescheduled_at' => now(),
            'rescheduled_from_booking_id' => $booking->rescheduled_from_booking_id ?: $booking->id,
            'reschedule_reason' => $validated['reason'] ?? null,
        ]);

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => 'ADMIN',
            'actor_id' => optional($request->user())->id,
            'action' => 'RESCHEDULE_BOOKING',
            'meta' => [
                'old_start_at' => $oldStart?->toDateTimeString(),
                'old_end_at' => $oldEnd?->toDateTimeString(),
                'new_start_at' => $newStart->toDateTimeString(),
                'new_end_at' => $newEnd->toDateTimeString(),
                'reason' => $validated['reason'] ?? null,
                'admin_override' => true,
            ],
            'created_at' => now(),
        ]);

        return $this->respond($booking->fresh(['service', 'staff', 'customer']));
    }
}
