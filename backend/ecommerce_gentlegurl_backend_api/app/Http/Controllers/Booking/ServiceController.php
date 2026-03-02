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

        $payload = $services->map(function (BookingService $service) {
            return $this->mapService($service, false);
        })->values();

        return $this->respond($payload);
    }

    public function show(int $id)
    {
        $service = BookingService::query()->findOrFail($id);

        return $this->respond($this->mapService($service, true));
    }

    private function mapService(BookingService $service, bool $includeDescription): array
    {
        $staffRows = BookingServiceStaff::query()
            ->where('service_id', $service->id)
            ->where('is_active', true)
            ->get(['staff_id']);

        $staffIds = $staffRows->pluck('staff_id')->unique()->values()->all();
        $staffs = Staff::query()
            ->whereIn('id', $staffIds)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(function (Staff $staff) {
                return [
                    'id' => (int) $staff->id,
                    'name' => $staff->name,
                ];
            })
            ->values()
            ->all();

        $payload = [
            'id' => (int) $service->id,
            'name' => $service->name,
            'duration_min' => (int) $service->duration_min,
            'duration_minutes' => (int) $service->duration_min,
            'deposit_amount' => (float) $service->deposit_amount,
            'buffer_min' => (int) $service->buffer_min,
            'is_active' => (bool) $service->is_active,
            'staffs' => $staffs,
        ];

        if ($includeDescription) {
            $payload['description'] = $service->description;
        }

        return $payload;
    }
}
