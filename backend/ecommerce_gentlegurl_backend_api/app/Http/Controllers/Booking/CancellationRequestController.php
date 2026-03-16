<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingCancellationRequest;
use Illuminate\Http\Request;

class CancellationRequestController extends Controller
{
    public function store(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer = $request->user('customer');

        $booking = Booking::query()
            ->where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        if ($booking->status !== 'CONFIRMED') {
            return $this->respondError('Cancellation request is only allowed for confirmed bookings.', 422);
        }

        if (! $booking->start_at || now()->greaterThanOrEqualTo($booking->start_at)) {
            return $this->respondError('Cancellation request is only allowed before booking time.', 422);
        }

        $existingPending = BookingCancellationRequest::query()
            ->where('booking_id', (int) $booking->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPending) {
            return $this->respondError('A cancellation request is already pending for this booking.', 422);
        }

        $requestRecord = BookingCancellationRequest::query()->create([
            'booking_id' => (int) $booking->id,
            'customer_id' => (int) $customer->id,
            'reason' => $validated['reason'] ?? null,
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        return $this->respond($requestRecord, 'Cancellation request submitted. Our team will review it.');
    }

    public function my(Request $request)
    {
        $customer = $request->user('customer');

        $requests = BookingCancellationRequest::query()
            ->with(['booking:id,booking_code,start_at,status,service_id,staff_id', 'booking.service:id,name', 'booking.staff:id,name'])
            ->where('customer_id', $customer->id)
            ->orderByDesc('requested_at')
            ->paginate($request->integer('per_page', 20));

        return $this->respond($requests);
    }
}
