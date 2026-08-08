<?php

namespace App\Http\Controllers;

use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;

class MeStoreLocationController extends Controller
{
    public function __invoke(Request $request, StoreLocationAccessService $access)
    {
        $locations = $access->accessibleStoreLocations($request->user(), true)
            ->get()
            ->map(fn ($location) => [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
                'is_active' => (bool) $location->is_active,
                'is_pickup_available' => (bool) $location->is_pickup_available,
                'is_booking_available' => (bool) $location->is_booking_available,
                'is_pos_available' => (bool) $location->is_pos_available,
                'sort_order' => (int) $location->sort_order,
            ])
            ->values();

        return $this->respond($locations);
    }
}
