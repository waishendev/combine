<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\StoreLocation;
use App\Services\SettingService;
use Illuminate\Validation\ValidationException;

class ShippingFulfillmentService
{
    public const SETTING_KEY = 'ecommerce.shipping_fulfillment_priority';

    public function __construct(private PickupFulfillmentService $fulfillment) {}

    /** @param array<int, array<string, mixed>> $items */
    public function selectBranch(array $items, bool $lockInventory = false): StoreLocation
    {
        $priority = collect(SettingService::get(self::SETTING_KEY, [], 'ecommerce'))
            ->map(fn ($id) => (int) $id)->filter()->unique()->values();

        $branches = StoreLocation::query()
            ->whereIn('id', $priority)
            ->where('is_active', true)
            ->get()->keyBy('id');

        foreach ($priority as $branchId) {
            $branch = $branches->get($branchId);
            if ($branch && $this->fulfillment->assessAtBranch($branch->id, $items, $lockInventory)['available']) {
                return $branch;
            }
        }

        throw ValidationException::withMessages([
            'shipping_fulfillment' => [__('Some items are currently unavailable for shipping.')],
            'unavailable_items' => [[
                'code' => 'no_shipping_fulfillment_branch',
                'message' => __('No single shipping Branch can fulfil the whole cart.'),
            ]],
        ])->status(422);
    }
}
