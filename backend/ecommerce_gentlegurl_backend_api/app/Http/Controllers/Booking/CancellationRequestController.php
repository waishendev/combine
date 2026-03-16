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

        if (in_array($booking->status, ['CANCELLED', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION'], true)) {
            return $this->respondError('This booking is already cancelled.', 422);
        }

        $requestRecord = BookingCancellationRequest::query()->create([
            'booking_id' => (int) $booking->id,
            'customer_id' => (int) $customer->id,
            'reason' => $validated['reason'] ?? null,
            'status' => 'PENDING',
        ]);

        return $this->respond($requestRecord, 'Cancellation request submitted successfully.');
    }
}
