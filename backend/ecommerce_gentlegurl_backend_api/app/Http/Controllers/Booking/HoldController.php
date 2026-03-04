<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Setting;
use App\Services\Booking\BookingAvailabilityService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HoldController extends Controller
{
    public function __construct(private readonly BookingAvailabilityService $availabilityService)
    {
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone' => ['nullable', 'string', 'max:50'],
            'guest_email' => ['nullable', 'email', 'max:255'],
        ]);

        $customer = $request->user('customer');
        if (!$customer && empty($validated['guest_name']) && empty($validated['guest_phone'])) {
            return $this->respondError('Guest name and guest phone are required for guest booking.', 422);
        }

        $service = BookingService::findOrFail($validated['service_id']);
        $startAt = Carbon::parse($validated['start_at']);
        $endAt = $startAt->copy()->addMinutes((int) $service->duration_min);

        $holdMinutes = (int) (Setting::where('type', 'booking')->where('key', 'BOOKING_HOLD_MINUTES')->value('value') ?? 15);

        $booking = DB::transaction(function () use ($validated, $customer, $service, $startAt, $endAt, $holdMinutes) {
            if ($this->availabilityService->hasConflict((int) $validated['staff_id'], $startAt, $endAt, (int) $service->buffer_min)) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'Selected slot is no longer available.',
                    'data' => null,
                ], 409));
            }

            $booking = Booking::create([
                'booking_code' => 'BK-' . now()->format('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'source' => $customer ? 'CUSTOMER' : 'GUEST',
                'customer_id' => $customer?->id,
                'guest_name' => $customer ? null : ($validated['guest_name'] ?? null),
                'guest_phone' => $customer ? null : ($validated['guest_phone'] ?? null),
                'guest_email' => $customer ? null : ($validated['guest_email'] ?? null),
                'staff_id' => $validated['staff_id'],
                'service_id' => $validated['service_id'],
                'start_at' => $startAt,
                'end_at' => $endAt,
                'buffer_min' => $service->buffer_min,
                'status' => 'HOLD',
                'deposit_amount' => $service->deposit_amount,
                'payment_status' => 'UNPAID',
                'hold_expires_at' => now()->addMinutes($holdMinutes),
            ]);

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => $customer ? 'SYSTEM' : 'SYSTEM',
                'actor_id' => $customer?->id,
                'action' => 'CREATE_BOOKING',
                'meta' => ['status' => 'HOLD'],
                'created_at' => now(),
            ]);

            return $booking;
        });

        return $this->respond([
            'booking_id' => $booking->id,
            'status' => $booking->status,
            'hold_expires_at' => $booking->hold_expires_at?->toIso8601String(),
            'deposit_amount' => number_format((float) $booking->deposit_amount, 2, '.', ''),
        ]);
    }
}
