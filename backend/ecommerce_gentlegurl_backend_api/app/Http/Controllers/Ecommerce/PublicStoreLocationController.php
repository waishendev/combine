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
        $availabilityColumn = $request->query('for') === 'reviews'
            ? 'is_review_available'
            : 'is_pickup_available';

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

        return $this->respond($locations);
    }

    public function show(Request $request, StoreLocation $storeLocation): JsonResponse
    {
        $isAvailable = $request->query('for') === 'reviews'
            ? $storeLocation->is_review_available
            : $storeLocation->is_pickup_available;
        abort_unless($storeLocation->is_active && $isAvailable, 404);

        $storeLocation->load('images');

        return $this->respond($storeLocation);
    }
}
