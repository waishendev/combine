<?php

namespace App\Http\Controllers;

use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use App\Models\Ecommerce\BranchInventoryCutoverState;

class MeStoreLocationController extends Controller
{
    public function __invoke(Request $request, StoreLocationAccessService $access)
    {
        $states = BranchInventoryCutoverState::query()->get()->keyBy('store_location_id');
        $locations = $access->accessibleStoreLocations($request->user(), true)
            ->get()
            ->map(function ($location) use ($states) {
                $status = $states->get($location->id)?->status ?? BranchInventoryCutoverState::PENDING;
                return [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
                'is_active' => (bool) $location->is_active,
                'is_pickup_available' => (bool) $location->is_pickup_available,
                'is_booking_available' => (bool) $location->is_booking_available,
                'is_pos_available' => (bool) $location->is_pos_available,
                'sort_order' => (int) $location->sort_order,
                'inventory_cutover_status' => $status,
                'inventory_is_authoritative' => $status === BranchInventoryCutoverState::ACTIVE,
                'inventory_authority_label' => $status === BranchInventoryCutoverState::ACTIVE
                    ? 'Branch inventory active'
                    : ($status === BranchInventoryCutoverState::RECONCILED ? 'Reconciled Branch Inventory — not yet active' : 'Global legacy inventory authoritative'),
                ];
            })
            ->values();

        return $this->respond($locations);
    }
}
