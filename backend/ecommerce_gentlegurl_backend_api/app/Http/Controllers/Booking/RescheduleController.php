<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\SettingService;
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
        if ($booking->status !== 'CONFIRMED') {
            return $this->respondError('Only confirmed bookings can be rescheduled.', 422);
        }

        $policy = SettingService::get('booking_policy', [
            'reschedule' => [
                'enabled' => true,
                'max_changes' => 1,
                'cutoff_hours' => 72,
            ],
        ], 'booking');

        $rescheduleEnabled = (bool) data_get($policy, 'reschedule.enabled', true);
        $maxChanges = (int) data_get($policy, 'reschedule.max_changes', 1);
        $cutoffHours = (int) data_get($policy, 'reschedule.cutoff_hours', 72);

        if (! $rescheduleEnabled) {
            return $this->respondError('Booking reschedule is disabled.', 422);
        }

        if (($booking->reschedule_count ?? 0) >= $maxChanges) {
            return $this->respondError("Booking can only be rescheduled {$maxChanges} time(s).", 422);
        }

        if ($cutoffHours > 0 && now()->gt($booking->start_at->copy()->subHours($cutoffHours))) {
            return $this->respondError("Booking time cannot be changed within {$cutoffHours} hours.", 422);
        }

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
            'reschedule_count' => (int) ($booking->reschedule_count ?? 0) + 1,
            'rescheduled_at' => now(),
            'rescheduled_from_booking_id' => $booking->rescheduled_from_booking_id ?: $booking->id,
            'reschedule_reason' => $validated['reason'] ?? null,
        ]);

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => 'SYSTEM',
            'actor_id' => null,
            'action' => 'RESCHEDULE_BOOKING',
            'meta' => [
                'old_start_at' => $oldStart?->toDateTimeString(),
                'old_end_at' => $oldEnd?->toDateTimeString(),
                'new_start_at' => $newStart->toDateTimeString(),
                'new_end_at' => $newEnd->toDateTimeString(),
                'reason' => $validated['reason'] ?? null,
                'admin_override' => false,
            ],
            'created_at' => now(),
        ]);

        return $this->respond($booking->fresh(['service', 'staff', 'customer']));
    }
}
