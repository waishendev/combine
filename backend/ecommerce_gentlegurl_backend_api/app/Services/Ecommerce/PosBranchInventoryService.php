<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PosCart;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use Illuminate\Validation\ValidationException;

class PosBranchInventoryService
{
    public function __construct(
        private OrderBranchInventoryService $authority,
        private PickupFulfillmentService $requirements,
        private BranchInventoryMutationService $inventory,
    ) {}

    public function isActive(PosCart $cart): bool
    {
        return $cart->store_location_id && $this->authority->isActive((int) $cart->store_location_id);
    }

    public function validateCart(PosCart $cart, bool $lock = false): void
    {
        $items = $this->items($cart);
        if ($items === []) {
            return;
        }

        if ($this->isActive($cart)) {
            $this->requirements->validateAtBranch((int) $cart->store_location_id, $items, $lock);

            return;
        }

        $this->validateLegacyGlobalStock($items);
    }

    /**
     * Validate stock for the cart as it would look after setting (or inserting) one product line.
     *
     * Bundles and regular component SKUs share physical stock — requirements are aggregated
     * across the whole projected cart (same as checkout).
     *
     * @param  array{product_id:int,product_variant_id:?int,quantity:int}  $proposedLine
     * @param  int|null  $replaceCartItemId  existing cart line being replaced/updated
     * @param  list<int>  $extraExcludeCartItemIds  additional cart lines to omit (e.g. merge duplicates)
     */
    public function validateCartWithProposedLine(
        PosCart $cart,
        array $proposedLine,
        ?int $replaceCartItemId = null,
        array $extraExcludeCartItemIds = [],
    ): void {
        $items = $this->projectItems($cart, $proposedLine, $replaceCartItemId, $extraExcludeCartItemIds);
        if ($items === []) {
            return;
        }

        if ($this->isActive($cart)) {
            $this->requirements->validateAtBranch((int) $cart->store_location_id, $items, false);

            return;
        }

        $this->validateLegacyGlobalStock($items);
    }

    public function deduct(PosCart $cart, Order $order, ?int $actorId): bool
    {
        if (! $this->isActive($cart)) {
            return false;
        }
        $items = $this->items($cart);
        $this->requirements->validateAtBranch((int) $cart->store_location_id, $items, true);
        $mutations = $this->requirements->inventoryRequirements($items)
            ->filter(fn ($line) => $line['track_stock'])
            ->map(fn ($line) => [
                'product_id' => $line['product_id'], 'product_variant_id' => $line['product_variant_id'],
                'delta' => -$line['quantity'], 'type' => 'stock_out', 'remark' => 'POS checkout',
                'idempotency_key' => "pos-order:{$order->id}:stock:{$line['product_id']}:".($line['product_variant_id'] ?? 0),
            ])->values()->all();
        if ($mutations !== []) {
            $this->inventory->mutateMany((int) $cart->store_location_id, $mutations, $actorId, $order);
        }
        return true;
    }

    /** @param array<int,array<string,mixed>> $items */
    public function deductItems(int $branchId, array $items, string $operationKey, Order $order, ?int $actorId, string $remark): bool
    {
        if (! $this->authority->isActive($branchId)) {
            return false;
        }
        $this->requirements->validateAtBranch($branchId, $items, true);
        $mutations = $this->requirements->inventoryRequirements($items)
            ->filter(fn ($line) => $line['track_stock'])
            ->map(fn ($line) => [
                'product_id' => $line['product_id'], 'product_variant_id' => $line['product_variant_id'],
                'delta' => -$line['quantity'], 'type' => 'stock_out', 'remark' => $remark,
                'idempotency_key' => "{$operationKey}:{$line['product_id']}:".($line['product_variant_id'] ?? 0),
            ])->values()->all();
        if ($mutations !== []) {
            $this->inventory->mutateMany($branchId, $mutations, $actorId, $order);
        }
        return true;
    }

    /**
     * @param  array{product_id:int,product_variant_id:?int,quantity:int}  $proposedLine
     * @param  list<int>  $extraExcludeCartItemIds
     * @return array<int, array{product_id:int,product_variant_id:?int,quantity:int}>
     */
    public function projectItems(
        PosCart $cart,
        array $proposedLine,
        ?int $replaceCartItemId = null,
        array $extraExcludeCartItemIds = [],
    ): array {
        $cart->loadMissing(['items.variant.product', 'items.product']);
        $exclude = array_values(array_unique(array_filter(array_map(
            static fn ($id) => $id !== null ? (int) $id : null,
            array_merge($extraExcludeCartItemIds, [$replaceCartItemId]),
        ))));
        $projected = [];

        foreach ($cart->items as $item) {
            if (($item->item_type ?? 'product') === 'booking_product') {
                continue;
            }
            if (in_array((int) $item->id, $exclude, true)) {
                continue;
            }

            $product = $item->variant?->product ?? $item->product;
            $productId = (int) ($product?->id ?? 0);
            if ($productId <= 0) {
                continue;
            }

            $projected[] = [
                'product_id' => $productId,
                'product_variant_id' => $item->variant?->id,
                'quantity' => (int) $item->qty,
            ];
        }

        $proposedQty = max(0, (int) ($proposedLine['quantity'] ?? 0));
        $proposedProductId = (int) ($proposedLine['product_id'] ?? 0);
        if ($proposedQty > 0 && $proposedProductId > 0) {
            $projected[] = [
                'product_id' => $proposedProductId,
                'product_variant_id' => array_key_exists('product_variant_id', $proposedLine)
                    ? ($proposedLine['product_variant_id'] !== null ? (int) $proposedLine['product_variant_id'] : null)
                    : null,
                'quantity' => $proposedQty,
            ];
        }

        return $projected;
    }

    /** @return array<int,array<string,mixed>> */
    private function items(PosCart $cart): array
    {
        $cart->loadMissing(['items.variant.product', 'items.product']);
        return $cart->items->filter(fn ($item) => ($item->item_type ?? 'product') !== 'booking_product')
            ->map(function ($item) {
                $product = $item->variant?->product ?? $item->product;
                return ['product_id' => (int) $product?->id, 'product_variant_id' => $item->variant?->id, 'quantity' => (int) $item->qty];
            })->filter(fn ($item) => $item['product_id'] > 0)->values()->all();
    }

    /**
     * When branch inventory cutover is inactive, still aggregate bundle + component demand
     * against global variant/product stock so mixed carts cannot oversell.
     *
     * @param  array<int, array{product_id:int,product_variant_id:?int,quantity:int}>  $items
     */
    private function validateLegacyGlobalStock(array $items): void
    {
        $requirements = $this->requirements->inventoryRequirements($items)
            ->filter(fn ($line) => (bool) ($line['track_stock'] ?? false));

        if ($requirements->isEmpty()) {
            return;
        }

        $variantIds = $requirements->pluck('product_variant_id')->filter()->unique()->values()->all();
        $variants = $variantIds === []
            ? collect()
            : ProductVariant::query()->whereIn('id', $variantIds)->get()->keyBy('id');

        $productOnlyIds = $requirements
            ->filter(fn ($line) => empty($line['product_variant_id']))
            ->pluck('product_id')
            ->unique()
            ->values()
            ->all();
        $products = $productOnlyIds === []
            ? collect()
            : Product::query()->whereIn('id', $productOnlyIds)->get()->keyBy('id');

        foreach ($requirements as $requirement) {
            $needed = (int) ($requirement['quantity'] ?? 0);
            if ($needed <= 0) {
                continue;
            }

            $variantId = $requirement['product_variant_id'] ?? null;
            if ($variantId) {
                $variant = $variants->get((int) $variantId);
                $available = (int) ($variant?->stock ?? 0);
            } else {
                $product = $products->get((int) $requirement['product_id']);
                $available = (int) ($product?->stock ?? 0);
            }

            if ($available < $needed) {
                throw ValidationException::withMessages([
                    'inventory' => [__('Insufficient stock.')],
                ])->status(422);
            }
        }
    }
}
