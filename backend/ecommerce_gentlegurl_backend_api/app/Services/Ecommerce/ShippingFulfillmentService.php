<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Validation\ValidationException;

class ShippingFulfillmentService
{
    public const SETTING_KEY = 'ecommerce.shipping_fulfillment_priority';

    public function __construct(private PickupFulfillmentService $fulfillment) {}

    /** @param array<int, array<string, mixed>> $items */
    public function selectBranch(array $items, bool $lockInventory = false): StoreLocation
    {
        $priority = app(ShippingFulfillmentPriorityService::class)->current();

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

    /**
     * Assign every cart line, in priority order, to one Branch capable of
     * fulfilling the complete line quantity. Quantities are never split.
     *
     * @return array<int, StoreLocation> keyed by the original cart line index
     */
    public function assignBranches(array $items, bool $lockInventory = false): array
    {
        $assignments = [];
        $unavailable = [];

        foreach ($items as $index => $item) {
            try {
                $assignments[$index] = $this->selectBranch([$item], $lockInventory);
            } catch (ValidationException) {
                $unavailable[] = [
                    'code' => 'no_shipping_fulfillment_branch',
                    'product_id' => $item['product_id'] ?? null,
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'name' => $item['name'] ?? null,
                    'message' => __('This item is currently unavailable for delivery.'),
                ];
            }
        }

        if ($unavailable !== []) {
            throw ValidationException::withMessages([
                'shipping_fulfillment' => [__('Some items are currently unavailable for delivery.')],
                'unavailable_items' => $unavailable,
            ])->status(422);
        }

        return $assignments;
    }
}
