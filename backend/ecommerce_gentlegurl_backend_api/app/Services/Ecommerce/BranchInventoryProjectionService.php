<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocationProductInventory;

class BranchInventoryProjectionService
{
    public function project(int $productId, ?int $variantId): int
    {
        $aggregate = (int) StoreLocationProductInventory::query()
            ->join('branch_inventory_cutover_states as cutover', function ($join) {
                $join->on('cutover.store_location_id', '=', 'store_location_product_inventories.store_location_id')
                    ->where('cutover.status', BranchInventoryCutoverState::ACTIVE);
            })
            ->join('store_locations as branch', function ($join) {
                $join->on('branch.id', '=', 'store_location_product_inventories.store_location_id')->where('branch.is_active', true);
            })
            ->where('product_id', $productId)
            ->when($variantId, fn ($query, $id) => $query->where('product_variant_id', $id), fn ($query) => $query->whereNull('product_variant_id'))
            ->sum('quantity');

        if ($variantId) {
            ProductVariant::query()->whereKey($variantId)->update(['stock' => $aggregate]);
        } else {
            Product::query()->whereKey($productId)->update(['stock' => $aggregate, 'stock_quantity' => $aggregate]);
        }

        return $aggregate;
    }

    public function projectAll(): void
    {
        StoreLocationProductInventory::query()
            ->select(['product_id', 'product_variant_id'])->distinct()
            ->orderBy('product_id')->orderBy('product_variant_id')
            ->chunk(500, fn ($rows) => $rows->each(fn ($row) => $this->project((int) $row->product_id, $row->product_variant_id ? (int) $row->product_variant_id : null)));
    }
}
