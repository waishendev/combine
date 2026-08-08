<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Model;

/**
 * The single Phase 6B balance+ledger transaction boundary.
 *
 * This service is intentionally not wired into legacy writers until a Branch has
 * passed reconciliation and the ecommerce/refund blockers in the runbook are resolved.
 */
class BranchInventoryMutationService
{
    /**
     * @param array<int, array{product_id:int, product_variant_id?:int|null, delta:int, type:string, remark?:string|null, idempotency_key:string}> $mutations
     */
    public function mutateMany(
        int $storeLocationId,
        array $mutations,
        ?int $actorUserId = null,
        ?Model $reference = null,
    ): Collection {
        return DB::transaction(function () use ($storeLocationId, $mutations, $actorUserId, $reference) {
            $this->assertActive($storeLocationId);

            $normalized = collect($mutations)
                ->map(fn (array $item) => $this->normalize($item))
                ->sortBy(fn (array $item) => sprintf('%020d:%020d', $item['product_id'], $item['product_variant_id'] ?? 0))
                ->values();

            if ($normalized->pluck('idempotency_key')->duplicates()->isNotEmpty()) {
                throw ValidationException::withMessages(['inventory' => 'Duplicate inventory idempotency keys were supplied.']);
            }
            if ($normalized->map(fn ($item) => $this->identity($item))->duplicates()->isNotEmpty()) {
                throw ValidationException::withMessages(['inventory' => 'Combine duplicate Product/Variant inventory mutations before applying them.']);
            }

            $existing = ProductStockMovement::query()
                ->whereIn('idempotency_key', $normalized->pluck('idempotency_key'))
                ->get()->keyBy('idempotency_key');
            if ($existing->isNotEmpty()) {
                if ($existing->count() !== $normalized->count()) {
                    throw ValidationException::withMessages(['inventory' => 'A partially applied inventory operation cannot be replayed.']);
                }
                return $normalized->map(fn ($item) => $existing[$item['idempotency_key']]);
            }

            $rows = collect();
            foreach ($normalized as $item) {
                $row = StoreLocationProductInventory::query()
                    ->where('store_location_id', $storeLocationId)
                    ->where('product_id', $item['product_id'])
                    ->where('variant_identity', $item['product_variant_id'] ?? 0)
                    ->lockForUpdate()->first();
                if (! $row) {
                    throw ValidationException::withMessages(['inventory' => 'Branch inventory is unresolved for one or more items.']);
                }
                $rows->put($this->identity($item), $row);
            }

            // Validate every line before changing any row; the transaction also guards rollback.
            foreach ($normalized as $item) {
                $after = (int) $rows[$this->identity($item)]->quantity + $item['delta'];
                if ($after < 0) {
                    throw ValidationException::withMessages(['inventory' => 'Insufficient stock at the operating Branch.']);
                }
            }

            return $normalized->map(function (array $item) use ($rows, $storeLocationId, $actorUserId, $reference) {
                $row = $rows[$this->identity($item)];
                $before = (int) $row->quantity;
                $after = $before + $item['delta'];
                $row->update(['quantity' => $after]);
                $cost = $item['product_variant_id']
                    ? (float) ProductVariant::query()->whereKey($item['product_variant_id'])->value('cost_price')
                    : (float) Product::query()->whereKey($item['product_id'])->value('cost_price');

                return ProductStockMovement::create([
                    'store_location_id' => $storeLocationId,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'],
                    'type' => $item['type'],
                    'quantity_before' => $before,
                    'quantity_change' => abs($item['delta']),
                    'quantity_delta' => $item['delta'],
                    'quantity_after' => $after,
                    'cost_price_before' => $cost,
                    'cost_price_after' => $cost,
                    'inventory_value_before' => round($before * $cost, 2),
                    'inventory_value_after' => round($after * $cost, 2),
                    'remark' => $item['remark'],
                    'created_by_user_id' => $actorUserId,
                    'reference_type' => $reference ? $reference::class : null,
                    'reference_id' => $reference?->getKey(),
                    'idempotency_key' => $item['idempotency_key'],
                ]);
            });
        }, 3);
    }

    /** @return array<int, array<string, mixed>> */
    public function bundleDecrements(ProductVariant $bundle, int $quantity, string $operationKey): array
    {
        if (! $bundle->is_bundle) {
            throw ValidationException::withMessages(['inventory' => 'The selected Variant is not a bundle.']);
        }
        $bundle->loadMissing('bundleItems.componentVariant');
        return $bundle->bundleItems->filter(fn ($item) => $item->componentVariant?->track_stock)
            ->groupBy(fn ($item) => (int) $item->component_variant_id)
            ->map(function ($items, $variantId) use ($quantity, $operationKey) {
                $variant = $items->first()->componentVariant;
                $required = $items->sum(fn ($item) => max(1, (int) $item->quantity)) * $quantity;
                return [
                    'product_id' => (int) $variant->product_id,
                    'product_variant_id' => (int) $variantId,
                    'delta' => -$required,
                    'type' => 'stock_out',
                    'remark' => 'Bundle component deduction',
                    'idempotency_key' => $operationKey.':component:'.$variantId,
                ];
            })->values()->all();
    }

    private function assertActive(int $storeLocationId): void
    {
        if (! BranchInventoryCutoverState::query()->where('store_location_id', $storeLocationId)->where('status', BranchInventoryCutoverState::ACTIVE)->exists()) {
            throw ValidationException::withMessages(['inventory' => 'Branch inventory authority is not active for this Branch.']);
        }
    }

    private function normalize(array $item): array
    {
        $item['product_id'] = (int) $item['product_id'];
        $item['product_variant_id'] = empty($item['product_variant_id']) ? null : (int) $item['product_variant_id'];
        $item['delta'] = (int) $item['delta'];
        $item['remark'] = $item['remark'] ?? null;
        if ($item['product_id'] <= 0 || $item['delta'] === 0 || trim((string) ($item['idempotency_key'] ?? '')) === '') {
            throw ValidationException::withMessages(['inventory' => 'Invalid Branch inventory mutation.']);
        }
        return $item;
    }

    private function identity(array $item): string
    {
        return $item['product_id'].':'.($item['product_variant_id'] ?? 0);
    }
}
