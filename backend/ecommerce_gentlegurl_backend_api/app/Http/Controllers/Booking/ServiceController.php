<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function categories()
    {
        $categories = BookingServiceCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respond($categories->map(fn (BookingServiceCategory $category) => [
            'id' => (int) $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image_path' => $category->image_path,
            'image_url' => $category->image_url,
            'is_active' => (bool) $category->is_active,
            'sort_order' => (int) $category->sort_order,
        ])->values());
    }

    public function index(Request $request)
    {
        $services = BookingService::query()
            ->where('is_active', true)
            ->when($request->filled('category_id'), function ($query) use ($request) {
                $query->whereHas('categories', function ($categoryQuery) use ($request) {
                    $categoryQuery->where('booking_service_category_id', (int) $request->integer('category_id'))
                        ->where('is_active', true);
                });
            })
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'description',
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

        $payload = $services->map(fn (BookingService $service) => $this->mapService($service, false))->values();

        return $this->respond($payload);
    }

    public function show(int $id)
    {
        $service = BookingService::query()->with(['primarySlots'])->findOrFail($id);

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

        $primarySlots = $service->relationLoaded('primarySlots')
            ? $service->primarySlots
            : $service->primarySlots()->where('is_active', true)->get();

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
            'primary_slots' => $primarySlots
                ->where('is_active', true)
                ->sortBy('sort_order')
                ->values()
                ->map(fn ($slot) => [
                    'id' => (int) $slot->id,
                    'start_time' => substr((string) $slot->start_time, 0, 5),
                    'sort_order' => (int) $slot->sort_order,
                    'is_active' => (bool) $slot->is_active,
                ])->all(),
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
