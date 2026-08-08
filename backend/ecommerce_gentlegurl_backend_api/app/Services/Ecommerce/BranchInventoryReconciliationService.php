<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Support\Collection;

class BranchInventoryReconciliationService
{
    public function analyse(StoreLocation $branch): array
    {
        $targets = $this->legacyTargets();
        $existing = StoreLocationProductInventory::query()->where('store_location_id', $branch->id)->get()
            ->keyBy(fn ($row) => $row->product_id.':'.$row->variant_identity);
        $missing = collect();
        $matching = 0;
        $mismatches = collect();

        foreach ($targets as $key => $target) {
            $row = $existing->get($key);
            if (! $row) {
                $missing->push($target);
            } elseif ((int) $row->quantity === (int) $target['quantity']) {
                $matching++;
            } else {
                $mismatches->push($target + ['branch_quantity' => (int) $row->quantity, 'inventory_id' => (int) $row->id]);
            }
        }

        $extra = $existing->reject(fn ($row, $key) => $targets->has($key));
        return [
            'branch' => ['id' => (int) $branch->id, 'code' => $branch->code, 'name' => $branch->name],
            'product_rows' => $targets->whereNull('product_variant_id')->count(),
            'variant_rows' => $targets->whereNotNull('product_variant_id')->count(),
            'legacy_total_quantity' => $targets->sum('quantity'),
            'existing_branch_total_quantity' => $existing->sum('quantity'),
            'missing_count' => $missing->count(),
            'matching_count' => $matching,
            'mismatch_count' => $mismatches->count(),
            'extra_count' => $extra->count(),
            'bundle_variants' => ProductVariant::query()->where('is_bundle', true)->count(),
            'bundle_component_links' => \App\Models\Ecommerce\ProductVariantBundleItem::query()->count(),
            'missing' => $missing->values()->all(),
            'mismatches' => $mismatches->values()->all(),
            'extra_inventory_ids' => $extra->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
        ];
    }

    public function legacyTargets(): Collection
    {
        $products = Product::query()->whereDoesntHave('variants')->get(['id', 'stock'])
            ->mapWithKeys(fn ($product) => [$product->id.':0' => [
                'product_id' => (int) $product->id,
                'product_variant_id' => null,
                'quantity' => max(0, (int) $product->stock),
            ]]);
        $variants = ProductVariant::query()->where('is_bundle', false)->get(['id', 'product_id', 'stock'])
            ->mapWithKeys(fn ($variant) => [$variant->product_id.':'.$variant->id => [
                'product_id' => (int) $variant->product_id,
                'product_variant_id' => (int) $variant->id,
                'quantity' => max(0, (int) $variant->stock),
            ]]);
        return $products->union($variants);
    }
}
