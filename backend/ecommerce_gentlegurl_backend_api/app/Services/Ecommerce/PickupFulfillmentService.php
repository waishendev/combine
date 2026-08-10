<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\Ecommerce\BranchInventoryCutoverState;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Authoritative whole-cart eligibility boundary for public self pickup.
 *
 * Branch balances are validation-only until the cutover state is active. The
 * legacy global reservation remains the stock authority during that period.
 */
class PickupFulfillmentService
{
    /**
     * @param array<int, array<string, mixed>> $items
     * @return array{store_location_id:int,available:bool,unavailable_items:array<int,array<string,mixed>>}
     */
    public function assess(int $storeLocationId, array $items, bool $lockInventory = false): array
    {
        return $this->assessAtBranch($storeLocationId, $items, $lockInventory, true);
    }

    /** @param array<int, array<string, mixed>> $items */
    public function assessAtBranch(int $storeLocationId, array $items, bool $lockInventory = false, bool $requirePickup = false): array
    {
        $location = StoreLocation::query()
            ->whereKey($storeLocationId)
            ->where('is_active', true)
            ->when($requirePickup, fn ($query) => $query->where('is_pickup_available', true))
            ->first();

        if (! $location) {
            return $this->result($storeLocationId, [[
                'code' => 'pickup_branch_unavailable',
                'message' => __('The selected pickup Branch is not available.'),
            ]]);
        }

        if (! BranchInventoryCutoverState::query()
            ->where('store_location_id', $storeLocationId)
            ->where('status', BranchInventoryCutoverState::ACTIVE)
            ->exists()) {
            return $this->result($storeLocationId, [[
                'code' => 'branch_inventory_not_active',
                'message' => __('This Branch is temporarily unavailable for Product fulfilment.'),
            ]]);
        }

        $requirements = $this->inventoryRequirements($items);
        $errors = [];

        $products = Product::query()
            ->with(['storeLocations' => fn ($query) => $query->whereKey($storeLocationId)])
            ->whereIn('id', $requirements->pluck('product_id')->unique())
            ->get()->keyBy('id');

        foreach ($requirements as $requirement) {
            $product = $products->get($requirement['product_id']);
            $sellable = $product?->storeLocations->contains(fn ($branch) => (bool) $branch->pivot->is_available);
            if (! $product || ! $sellable) {
                $errors[] = $this->itemError($requirement, 'product_unavailable', __('This item is not available at the selected pickup Branch.'));
                continue;
            }

            if (! $requirement['track_stock']) {
                continue;
            }

            $query = StoreLocationProductInventory::query()
                ->where('store_location_id', $storeLocationId)
                ->where('product_id', $requirement['product_id'])
                ->when(
                    $requirement['product_variant_id'],
                    fn ($query, $variantId) => $query->where('product_variant_id', $variantId),
                    fn ($query) => $query->whereNull('product_variant_id'),
                );
            $inventory = $lockInventory ? $query->lockForUpdate()->first() : $query->first();
            $available = (int) ($inventory?->quantity ?? 0);
            if ($available < $requirement['quantity']) {
                $errors[] = $this->itemError($requirement, 'insufficient_branch_stock', __('This item is out of stock at the selected pickup Branch.'));
            }
        }

        return $this->result($storeLocationId, $errors);
    }

    /** @param array<int, array<string, mixed>> $items */
    public function validate(int $storeLocationId, array $items, bool $lockInventory = false): void
    {
        $assessment = $this->assess($storeLocationId, $items, $lockInventory);
        if (! $assessment['available']) {
            throw ValidationException::withMessages([
                'store_location_id' => [__('The selected pickup Branch cannot fulfil the whole cart.')],
                'unavailable_items' => $assessment['unavailable_items'],
            ])->status(422);
        }
    }

    /** @param array<int, array<string, mixed>> $items */
    public function inventoryRequirements(array $items): Collection
    {
        $variants = ProductVariant::query()
            ->with('bundleItems.componentVariant')
            ->whereIn('id', collect($items)->pluck('product_variant_id')->filter()->unique())
            ->get()->keyBy('id');
        $products = Product::query()->whereIn('id', collect($items)->pluck('product_id')->unique())->get()->keyBy('id');
        $requirements = collect();

        foreach ($items as $item) {
            $quantity = max(0, (int) ($item['quantity'] ?? 0));
            if ($quantity === 0) {
                continue;
            }
            $variant = $variants->get((int) ($item['product_variant_id'] ?? 0));
            if ($variant?->is_bundle) {
                // The sellable bundle Product itself must be assigned as well as
                // every physical component; the bundle has no independent stock.
                $this->addRequirement($requirements, [
                    'product_id' => (int) ($item['product_id'] ?? 0),
                    'product_variant_id' => null,
                    'quantity' => $quantity,
                    'track_stock' => false,
                    'cart_product_id' => (int) ($item['product_id'] ?? 0),
                    'cart_product_variant_id' => (int) $variant->id,
                ]);
                foreach ($variant->bundleItems as $bundleItem) {
                    $component = $bundleItem->componentVariant;
                    if (! $component) {
                        continue;
                    }
                    $this->addRequirement($requirements, [
                        'product_id' => (int) $component->product_id,
                        'product_variant_id' => (int) $component->id,
                        'quantity' => max(1, (int) $bundleItem->quantity) * $quantity,
                        'track_stock' => (bool) $component->track_stock,
                        'cart_product_id' => (int) ($item['product_id'] ?? 0),
                        'cart_product_variant_id' => (int) ($item['product_variant_id'] ?? 0),
                    ]);
                }
                continue;
            }

            $product = $products->get((int) ($item['product_id'] ?? 0));
            $this->addRequirement($requirements, [
                'product_id' => (int) ($item['product_id'] ?? 0),
                'product_variant_id' => $variant?->id,
                'quantity' => $quantity,
                'track_stock' => (bool) ($variant ? $variant->track_stock : $product?->track_stock),
                'cart_product_id' => (int) ($item['product_id'] ?? 0),
                'cart_product_variant_id' => $variant?->id,
            ]);
        }

        return $requirements->values();
    }

    private function addRequirement(Collection $requirements, array $incoming): void
    {
        $key = $incoming['product_id'].':'.($incoming['product_variant_id'] ?? 0);
        if ($requirements->has($key)) {
            $incoming['quantity'] += $requirements[$key]['quantity'];
        }
        $requirements->put($key, $incoming);
    }

    private function itemError(array $requirement, string $code, string $message): array
    {
        return [
            'product_id' => $requirement['cart_product_id'],
            'product_variant_id' => $requirement['cart_product_variant_id'],
            'code' => $code,
            'message' => $message,
        ];
    }

    private function result(int $storeLocationId, array $errors): array
    {
        return ['store_location_id' => $storeLocationId, 'available' => $errors === [], 'unavailable_items' => $errors];
    }
}
