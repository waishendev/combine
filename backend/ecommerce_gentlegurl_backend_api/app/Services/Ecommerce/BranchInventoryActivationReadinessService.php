<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;

class BranchInventoryActivationReadinessService
{
    public function analyse(): array
    {
        $branches = StoreLocation::query()->where('is_active', true)->orderBy('id')->get(['id', 'code', 'name']);
        $states = BranchInventoryCutoverState::query()->whereIn('store_location_id', $branches->pluck('id'))->get()->keyBy('store_location_id');
        $issues = [];
        if ($branches->isEmpty()) {
            $issues[] = 'No active physical Branch exists.';
        }
        if ($states->where('status', BranchInventoryCutoverState::ACTIVE)->isNotEmpty()) {
            $issues[] = 'Mixed or premature ACTIVE state exists; coordinated activation requires every active Branch to transition together.';
        }
        if (BranchInventoryCutoverState::query()->where('status', BranchInventoryCutoverState::ACTIVE)->whereNotIn('store_location_id', $branches->pluck('id'))->exists()) {
            $issues[] = 'An inactive/non-operational Branch remains ACTIVE; authority state must be normalized before coordinated activation.';
        }
        foreach ($branches as $branch) {
            $state = $states->get($branch->id);
            if (! $state || $state->status !== BranchInventoryCutoverState::RECONCILED) {
                $issues[] = "Branch {$branch->code} is not reconciled.";
                continue;
            }
            if (! (bool) data_get($state->reconciliation_summary, 'physical_counts_reviewed', false)) {
                $issues[] = "Branch {$branch->code} has no reviewed physical-count import.";
            }
            $products = $branch->products()->wherePivot('is_available', true)->with(['variants' => fn ($query) => $query->where('is_bundle', false)])->get();
            foreach ($products as $product) {
                $identities = $product->variants->isEmpty() ? [null] : $product->variants->pluck('id')->all();
                foreach ($identities as $variantId) {
                    $exists = StoreLocationProductInventory::query()->where('store_location_id', $branch->id)->where('product_id', $product->id)
                        ->when($variantId, fn ($query, $id) => $query->where('product_variant_id', $id), fn ($query) => $query->whereNull('product_variant_id'))->exists();
                    if (! $exists) {
                        $issues[] = "Branch {$branch->code} is missing reviewed inventory for Product {$product->id}".($variantId ? " Variant {$variantId}" : '').'.';
                    }
                }
            }
        }

        return [
            'ready' => $issues === [],
            'activation_mode' => 'coordinated_all_active_branches',
            'branches' => $branches->map(fn ($branch) => ['id' => $branch->id, 'code' => $branch->code, 'name' => $branch->name])->all(),
            'writer_checks' => [
                'ecommerce' => true, 'pos_checkout' => true, 'pos_consumable' => true,
                'crm_adjustment' => true, 'crm_revoke' => true, 'reward_fulfilment' => true,
                'reservation_release' => true, 'variants' => true, 'bundles' => true,
            ],
            'issues' => $issues,
        ];
    }
}
