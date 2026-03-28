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
                'service_type',
                'service_price',
                'price',
                'is_package_eligible',
                'duration_min',
                'deposit_amount',
                'buffer_min',
                'is_active',
                'image_path',
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
            ->get(['id', 'name', 'position', 'description', 'avatar_path'])
            ->map(function (Staff $staff) {
                return [
                    'id' => (int) $staff->id,
                    'name' => $staff->name,
                    'position' => $staff->position,
                    'description' => $staff->description,
                    'avatar_path' => $staff->avatar_path,
                    'avatar_url' => $staff->avatar_url,
                ];
            })
            ->values()
            ->all();

        $payload = [
            'id' => (int) $service->id,
            'name' => $service->name,
            'service_type' => $service->service_type,
            'duration_min' => (int) $service->duration_min,
            'duration_minutes' => (int) $service->duration_min,
            'service_price' => (float) $service->service_price,
            'price' => (float) ($service->price ?? $service->service_price),
            'is_package_eligible' => (bool) ($service->is_package_eligible ?? true),
            'deposit_amount' => (float) $service->deposit_amount,
            'buffer_min' => (int) $service->buffer_min,
            'is_active' => (bool) $service->is_active,
            'image_path' => $service->image_path,
            'image_url' => $service->image_url,
            'staffs' => $staffs,
            'allowed_staffs' => $staffs,
            'allowed_staff_count' => count($staffs),
            'allowed_staff_names' => collect($staffs)->pluck('name')->filter()->values()->all(),
        ];

        if ($includeDescription) {
            $payload['description'] = $service->description;
        }

        return $payload;
    }
}
