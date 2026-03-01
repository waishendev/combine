<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingLog;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function pay(Request $request, int $id)
    {
        $booking = Booking::findOrFail($id);

        if ($booking->status !== 'HOLD') {
            return $this->respondError('Only HOLD booking can be paid.', 422);
        }

        $payment = BookingPayment::create([
            'booking_id' => $booking->id,
            'provider' => 'FPX',
            'amount' => $booking->deposit_amount,
            'status' => 'PENDING',
            'ref' => 'BKG-' . $booking->id . '-' . now()->timestamp,
            'raw_response' => [
                'payment_url' => url('/api/booking/payment/callback?booking_id=' . $booking->id . '&status=PAID'),
            ],
        ]);

        return $this->respond([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'status' => $payment->status,
            'provider' => $payment->provider,
            'payment_url' => $payment->raw_response['payment_url'] ?? null,
        ]);
    }

    public function callback(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'status' => ['required', 'in:PAID,FAILED'],
            'ref' => ['nullable', 'string'],
        ]);

        $booking = Booking::findOrFail($validated['booking_id']);
        $payment = BookingPayment::where('booking_id', $booking->id)
            ->latest('id')
            ->first();

        if (!$payment) {
            return $this->respondError('Payment record not found.', 404);
        }

        if ($validated['status'] === 'PAID') {
            $payment->update([
                'status' => 'PAID',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => $request->all(),
            ]);

            $booking->update([
                'payment_status' => 'PAID',
                'status' => 'CONFIRMED',
                'hold_expires_at' => null,
            ]);

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => ['payment_id' => $payment->id, 'ref' => $payment->ref],
                'created_at' => now(),
            ]);
        } else {
            $payment->update([
                'status' => 'FAILED',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => $request->all(),
            ]);

            $booking->update(['payment_status' => 'FAILED']);
        }

        return $this->respond([
            'booking_id' => $booking->id,
            'booking_status' => $booking->fresh()->status,
            'payment_status' => $booking->fresh()->payment_status,
        ]);
    }
}
