<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Services\Booking\BookingAvailabilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AvailabilityController extends Controller
{
    public function __construct(private readonly BookingAvailabilityService $availabilityService)
    {
    }

    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        if ($validator->fails()) {
            return $this->respondError('Invalid availability request.', 422, [
                'date' => (string) $request->input('date', ''),
                'service_id' => (int) $request->input('service_id', 0),
                'staff_id' => (int) $request->input('staff_id', 0),
                'duration_min' => null,
                'buffer_min' => null,
                'slot_step_min' => 15,
                'slots' => [],
                'errors' => $validator->errors(),
            ]);
        }

        $validated = $validator->validated();

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
