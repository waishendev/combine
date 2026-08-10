<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\StoreLocation;
use App\Services\Ecommerce\ShippingFulfillmentService;
use App\Services\SettingService;
use Illuminate\Http\Request;

class ShippingFulfillmentSettingController extends Controller
{
    public function show()
    {
        return $this->respond($this->payload());
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'store_location_ids' => ['present', 'array'],
            'store_location_ids.*' => ['integer', 'distinct', 'exists:store_locations,id'],
        ]);

        SettingService::set(
            ShippingFulfillmentService::SETTING_KEY,
            array_values(array_map('intval', $validated['store_location_ids'])),
            'ecommerce',
        );

        return $this->respond($this->payload(), __('Shipping fulfilment priority updated.'));
    }

    private function payload(): array
    {
        $ids = collect(SettingService::get(ShippingFulfillmentService::SETTING_KEY, [], 'ecommerce'))
            ->map(fn ($id) => (int) $id)->filter()->unique()->values();
        $branches = StoreLocation::query()->whereIn('id', $ids)->get(['id', 'name', 'code', 'is_active'])->keyBy('id');

        return [
            'store_location_ids' => $ids->all(),
            'branches' => $ids->map(fn ($id) => $branches->get($id))->filter()->values(),
        ];
    }
}
