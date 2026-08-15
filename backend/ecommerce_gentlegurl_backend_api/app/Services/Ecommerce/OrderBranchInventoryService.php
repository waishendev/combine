<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderInventoryReservation;
use Illuminate\Support\Facades\DB;

class OrderBranchInventoryService
{
    public function __construct(
        private PickupFulfillmentService $requirements,
        private BranchInventoryMutationService $inventory,
    ) {}

    public function isActive(int $storeLocationId): bool
    {
        return BranchInventoryCutoverState::query()
            ->where('store_location_id', $storeLocationId)
            ->where('status', BranchInventoryCutoverState::ACTIVE)
            ->whereHas('storeLocation', fn ($branch) => $branch->where('is_active', true))
            ->exists();
    }

    /** @param array<int, array<string, mixed>> $items */
    public function reserve(Order $order, array $items, int $reserveMinutes): void
    {
        $branchId = (int) $order->store_location_id;
        $requirements = $this->requirements->inventoryRequirements($items)
            ->filter(fn ($line) => $line['track_stock'])->values();
        $mutations = $requirements->map(fn ($line) => [
            'product_id' => $line['product_id'],
            'product_variant_id' => $line['product_variant_id'],
            'delta' => -$line['quantity'],
            'type' => 'reservation',
            'remark' => 'Ecommerce Order stock reservation',
            'idempotency_key' => "order:{$order->id}:reserve:{$line['product_id']}:".($line['product_variant_id'] ?? 0),
        ])->all();

        if ($mutations !== []) {
            $this->inventory->mutateMany($branchId, $mutations, null, $order);
        }

        foreach ($requirements as $line) {
            OrderInventoryReservation::query()->firstOrCreate(
                ['idempotency_key' => "order:{$order->id}:reserve:{$line['product_id']}:".($line['product_variant_id'] ?? 0)],
                [
                    'order_id' => $order->id,
                    'store_location_id' => $branchId,
                    'product_id' => $line['product_id'],
                    'product_variant_id' => $line['product_variant_id'],
                    'quantity' => $line['quantity'],
                    'status' => 'reserved',
                    'expires_at' => now()->addMinutes($reserveMinutes),
                ],
            );
        }
    }

    public function release(Order $order): bool
    {
        return DB::transaction(function () use ($order) {
            $reservations = OrderInventoryReservation::query()
                ->where('order_id', $order->id)->lockForUpdate()->get();
            if ($reservations->isEmpty()) {
                return false;
            }
            $reserved = $reservations->where('status', 'reserved');
            if ($reserved->isEmpty()) {
                return true;
            }

            $mutations = $reserved->map(fn ($line) => [
                'product_id' => (int) $line->product_id,
                'product_variant_id' => $line->product_variant_id ? (int) $line->product_variant_id : null,
                'delta' => (int) $line->quantity,
                'type' => 'release',
                'remark' => 'Ecommerce Order reservation release',
                'idempotency_key' => "order:{$order->id}:release:{$line->product_id}:".($line->product_variant_id ?? 0),
            ])->all();
            $this->inventory->mutateMany((int) $reserved->first()->store_location_id, $mutations, null, $order);
            OrderInventoryReservation::query()->whereIn('id', $reserved->pluck('id'))
                ->update(['status' => 'released', 'released_at' => now(), 'updated_at' => now()]);
            return true;
        });
    }
}
