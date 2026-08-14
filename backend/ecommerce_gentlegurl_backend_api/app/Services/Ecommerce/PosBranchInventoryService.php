<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PosCart;

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
        if (! $this->isActive($cart)) {
            return;
        }
        $this->requirements->validateAtBranch((int) $cart->store_location_id, $this->items($cart), $lock);
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
}
