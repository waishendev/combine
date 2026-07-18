<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Booking\Booking;
use App\Models\User;
use Illuminate\Support\Facades\Request;

class AppointmentActivityLogService
{
    public const ACTIONS = [
        'appointment.rescheduled' => 'Rescheduled Appointment',
        'appointment.cancelled' => 'Cancelled Appointment',
        'appointment.no_show' => 'Marked as No Show',
        'appointment.late_cancelled' => 'Marked as Late Cancellation',
        'appointment.completed' => 'Marked as Completed',
        'appointment.checked_out' => 'Checked Out Appointment',
        'appointment.email_queued' => 'Confirmation Email Queued',
        'appointment.package_applied' => 'Applied Package',
    ];

    public function log(Booking $booking, string $action, ?User $actor = null, array $meta = []): ?ActivityLog
    {
        if (! array_key_exists($action, self::ACTIONS)) {
            return null;
        }

        $booking->loadMissing('customer');
        $customerName = $booking->customer?->name
            ?: (trim((string) ($booking->guest_name ?? '')) ?: null);

        return ActivityLog::create([
            'user_id' => $actor?->id,
            'user_name' => $actor?->name ?: ($actor?->email ?: $actor?->username),
            'action' => $action,
            'model_type' => 'Booking',
            'model_id' => $booking->id,
            'model_label' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'old_values' => null,
            'new_values' => array_filter(array_merge([
                'appointment_id' => (int) $booking->id,
                'booking_number' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
                'customer_name' => $customerName,
                'action_label' => self::ACTIONS[$action],
            ], $meta), fn ($value) => $value !== null && $value !== ''),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}
