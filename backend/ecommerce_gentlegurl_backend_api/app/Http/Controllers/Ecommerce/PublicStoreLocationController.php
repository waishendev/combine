<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicStoreLocationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $availabilityColumn = match ($request->query('for')) {
            'reviews' => 'is_review_available',
            'booking' => 'is_booking_available',
            default => 'is_pickup_available',
        };

        $locations = StoreLocation::query()
            ->where('is_active', true)
            ->where($availabilityColumn, true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->with('images')
            ->get([
                'id',
                'name',
                'code',
                'address_line1',
                'address_line2',
                'city',
                'state',
                'postcode',
                'country',
                'phone',
                'opening_hours',
            ]);

        if ($request->query('for') === 'booking') {
            return $this->respond($locations->map(fn (StoreLocation $location) => $this->publicPayload($location))->values());
        }

        return $this->respond($locations);
    }

    public function show(Request $request, StoreLocation $storeLocation): JsonResponse
    {
        $isAvailable = match ($request->query('for')) {
            'reviews' => $storeLocation->is_review_available,
            'booking' => $storeLocation->is_booking_available,
            default => $storeLocation->is_pickup_available,
        };
        abort_unless($storeLocation->is_active && $isAvailable, 404);

        $storeLocation->load('images');

        return $this->respond($request->query('for') === 'booking' ? $this->publicPayload($storeLocation) : $storeLocation);
    }

    private function publicPayload(StoreLocation $location): array
    {
        return [
            'id' => (int) $location->id,
            'name' => (string) $location->name,
            'code' => (string) $location->code,
            'address_line1' => $location->address_line1,
            'address_line2' => $location->address_line2,
            'city' => $location->city,
            'state' => $location->state,
            'postcode' => $location->postcode,
            'country' => $location->country,
            'phone' => $location->phone,
            'opening_hours' => $location->opening_hours,
            'images' => $location->images->map(fn ($image) => [
                'id' => (int) $image->id,
                'image_url' => $image->image_url,
            ])->values(),
        ];
    }
}
