<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Services\Booking\BookingAvailabilityService;
use Illuminate\Http\Request;

class AvailabilityController extends Controller
{
    public function __construct(private readonly BookingAvailabilityService $availabilityService)
    {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        $service = BookingService::findOrFail($validated['service_id']);
        $slots = $this->availabilityService->getAvailableSlots($service, (int) $validated['staff_id'], $validated['date']);

        return $this->respond([
            'date' => $validated['date'],
            'service_id' => (int) $validated['service_id'],
            'staff_id' => (int) $validated['staff_id'],
            'duration_min' => (int) $service->duration_min,
            'buffer_min' => (int) $service->buffer_min,
            'slot_step_min' => 15,
            'slots' => $slots,
        ]);
    }
}
