<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Http\JsonResponse;

class PublicStoreLocationController extends Controller
{
    public function index(): JsonResponse
    {
        $locations = StoreLocation::query()
            ->where('is_active', true)
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

    public function show(StoreLocation $storeLocation): JsonResponse
    {
        abort_unless($storeLocation->is_active, 404);

        $storeLocation->load('images');

        return $this->respond($storeLocation);
    }
}
