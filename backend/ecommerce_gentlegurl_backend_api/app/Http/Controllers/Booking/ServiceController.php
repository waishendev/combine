<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;

class ServiceController extends Controller
{
    public function index()
    {
        $services = BookingService::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'duration_min',
                'deposit_amount',
                'buffer_min',
                'is_active',
            ]);

        $serviceIds = $services->pluck('id')->all();

        $staffRows = BookingServiceStaff::query()
            ->whereIn('service_id', $serviceIds)
            ->where('is_active', true)
            ->get(['service_id', 'staff_id']);

        $staffIds = $staffRows->pluck('staff_id')->unique()->values()->all();
        $staffMap = Staff::query()
            ->whereIn('id', $staffIds)
            ->where('is_active', true)
            ->get(['id', 'name'])
            ->keyBy('id');

        $staffByService = $staffRows
            ->groupBy('service_id')
            ->map(function ($rows) use ($staffMap) {
                return $rows
                    ->map(function ($row) use ($staffMap) {
                        $staff = $staffMap->get($row->staff_id);
                        if (!$staff) {
                            return null;
                        }

                        return [
                            'id' => (int) $staff->id,
                            'name' => $staff->name,
                        ];
                    })
                    ->filter()
                    ->values();
            });

        $payload = $services->map(function (BookingService $service) use ($staffByService) {
            return [
                'id' => (int) $service->id,
                'name' => $service->name,
                'duration_min' => (int) $service->duration_min,
                'duration_minutes' => (int) $service->duration_min,
                'deposit_amount' => (float) $service->deposit_amount,
                'buffer_min' => (int) $service->buffer_min,
                'is_active' => (bool) $service->is_active,
                'staffs' => $staffByService->get($service->id, collect())->all(),
            ];
        })->values();

        return $this->respond($payload);
    }
}
