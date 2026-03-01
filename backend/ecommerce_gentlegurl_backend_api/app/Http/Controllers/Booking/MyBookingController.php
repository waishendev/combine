<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use Illuminate\Http\Request;

class MyBookingController extends Controller
{
    public function index(Request $request)
    {
        $customer = $request->user('customer');

        $bookings = Booking::query()
            ->with([
                'service:id,name,duration_min,deposit_amount,buffer_min',
                'staff:id,name',
            ])
            ->where('customer_id', $customer->id)
            ->orderByDesc('start_at')
            ->get();

        $payload = $bookings->map(function (Booking $booking) {
            return [
                'id' => (int) $booking->id,
                'status' => $booking->status,
                'start_at' => $booking->start_at?->toIso8601String(),
                'starts_at' => $booking->start_at?->toIso8601String(),
                'deposit_amount' => (float) $booking->deposit_amount,
                'service_name' => $booking->service?->name,
                'staff_name' => $booking->staff?->name,
                'service' => $booking->service ? [
                    'id' => (int) $booking->service->id,
                    'name' => $booking->service->name,
                    'duration_min' => (int) $booking->service->duration_min,
                    'deposit_amount' => (float) $booking->service->deposit_amount,
                    'buffer_min' => (int) $booking->service->buffer_min,
                ] : null,
                'staff' => $booking->staff ? [
                    'id' => (int) $booking->staff->id,
                    'name' => $booking->staff->name,
                ] : null,
            ];
        })->values();

        return $this->respond($payload);
    }
}
