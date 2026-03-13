<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Services\Booking\BookingAvailabilityService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
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

    public function bulk(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        if ($validator->fails()) {
            return $this->respondError('Invalid availability request.', 422, [
                'date' => (string) $request->input('date', ''),
                'service_id' => (int) $request->input('service_id', 0),
                'time_slots' => [],
                'errors' => $validator->errors(),
            ]);
        }

        $validated = $validator->validated();
        $service = BookingService::findOrFail($validated['service_id']);

        // Get all staff for this service
        $serviceStaff = \App\Models\Booking\BookingServiceStaff::query()
            ->where('service_id', $service->id)
            ->where('is_active', true)
            ->get(['staff_id']);

        $staffIds = $serviceStaff->pluck('staff_id')->unique()->values()->all();
        $staffs = \App\Models\Staff::query()
            ->whereIn('id', $staffIds)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        if ($staffs->isEmpty()) {
            return $this->respond([
                'service_id' => (int) $validated['service_id'],
                'date' => $validated['date'],
                'time_slots' => [],
            ]);
        }

        // Collect all unique time slots from all staff schedules
        $allSlotKeys = [];
        $day = Carbon::parse($validated['date']);
        $durationMin = (int) $service->duration_min;
        $stepMin = 15;

        foreach ($staffs as $staff) {
            $schedule = \App\Models\Booking\BookingStaffSchedule::where('staff_id', $staff->id)
                ->where('day_of_week', $day->dayOfWeek)
                ->first();

            if ($schedule) {
                $startWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->start_time);
                $endWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->end_time);
                $period = CarbonPeriod::create($startWindow, $stepMin . ' minutes', $endWindow->copy()->subMinutes($durationMin));

                foreach ($period as $candidateStart) {
                    $slotKey = $candidateStart->toIso8601String();
                    $allSlotKeys[$slotKey] = [
                        'start_at' => $slotKey,
                        'end_at' => $candidateStart->copy()->addMinutes($durationMin)->toIso8601String(),
                    ];
                }
            }
        }

        // Build time slots with staff availability
        $timeSlots = [];
        foreach ($allSlotKeys as $slotKey => $slotInfo) {
            $startAt = Carbon::parse($slotInfo['start_at']);
            $endAt = Carbon::parse($slotInfo['end_at']);
            
            $staffAvailability = [];
            foreach ($staffs as $staff) {
                $isAvailable = !$this->availabilityService->hasConflict($staff->id, $startAt, $endAt, (int) $service->buffer_min);
                $staffAvailability[] = [
                    'staff_id' => (int) $staff->id,
                    'staff_name' => $staff->name,
                    'is_available' => $isAvailable,
                ];
            }

            $timeSlots[] = [
                'start_time' => $startAt->format('H:i'),
                'end_time' => $endAt->format('H:i'),
                'start_at' => $slotInfo['start_at'],
                'end_at' => $slotInfo['end_at'],
                'staff_availability' => $staffAvailability,
            ];
        }

        // Sort by start time
        usort($timeSlots, fn ($a, $b) => strcmp($a['start_at'], $b['start_at']));

        return $this->respond([
            'service_id' => (int) $validated['service_id'],
            'date' => $validated['date'],
            'time_slots' => $timeSlots,
        ]);
    }
}
