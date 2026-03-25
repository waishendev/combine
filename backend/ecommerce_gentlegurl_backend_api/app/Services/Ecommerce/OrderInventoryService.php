<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderInventoryService
{
    public function deductForOrder(Order $order, ?int $userId = null, ?string $remark = null): bool
    {
        return DB::transaction(function () use ($order, $userId, $remark) {
            $lockedOrder = Order::where('id', $order->id)
                ->lockForUpdate()
                ->first();

            if (! $lockedOrder || $lockedOrder->inventory_deducted_at) {
                return false;
            }

            $lockedOrder->loadMissing('items');
            $messages = [];

            foreach ($lockedOrder->items as $item) {
                if ($item->is_reward || (int) $item->quantity <= 0 || ! $item->product_id) {
                    continue;
                }

                $qty = (int) $item->quantity;
                $variantId = $item->product_variant_id ? (int) $item->product_variant_id : null;
                $movementRemark = $remark ?: sprintf('Auto generated from order checkout (%s).', $lockedOrder->order_number);
                $effectiveCost = $variantId
                    ? (float) ($item->variant_cost_snapshot ?? $item->cost_price_snapshot ?? 0)
                    : (float) ($item->cost_price_snapshot ?? 0);

                if ($variantId) {
                    $variant = ProductVariant::where('id', $variantId)->lockForUpdate()->first();
                    if (! $variant || ! $variant->track_stock) {
                        continue;
                    }

                    $before = (int) ($variant->stock ?? 0);
                    if ($before < $qty) {
                        $messages[] = __('Insufficient stock for :name (variant ID :id). Requested: :requested, Available: :available.', [
                            'name' => $variant->title ?? 'variant',
                            'id' => $variant->id,
                            'requested' => $qty,
                            'available' => $before,
                        ]);
                        continue;
                    }

                    $after = $before - $qty;
                    $variant->stock = $after;
                    $variant->save();

                    ProductStockMovement::create([
                        'product_id' => (int) $item->product_id,
                        'product_variant_id' => $variant->id,
                        'order_id' => $lockedOrder->id,
                        'type' => 'sale_out',
                        'quantity_before' => $before,
                        'quantity_change' => $qty,
                        'quantity_after' => $after,
                        'cost_price_before' => $effectiveCost,
                        'cost_price_after' => $effectiveCost,
                        'inventory_value_before' => round($before * $effectiveCost, 2),
                        'inventory_value_after' => round($after * $effectiveCost, 2),
                        'remark' => $movementRemark,
                        'created_by_user_id' => $userId ?? $lockedOrder->created_by_user_id,
                    ]);

                    continue;
                }

                $product = Product::where('id', (int) $item->product_id)->lockForUpdate()->first();
                if (! $product || ! $product->track_stock) {
                    continue;
                }

                $before = (int) ($product->stock_quantity ?? $product->stock ?? 0);
                if ($before < $qty) {
                    $messages[] = __('Insufficient stock for :name (product ID :id). Requested: :requested, Available: :available.', [
                        'name' => $product->name ?? 'product',
                        'id' => $product->id,
                        'requested' => $qty,
                        'available' => $before,
                    ]);
                    continue;
                }

                $after = $before - $qty;
                $product->stock = $after;
                $product->stock_quantity = $after;
                $product->save();

                ProductStockMovement::create([
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'order_id' => $lockedOrder->id,
                    'type' => 'sale_out',
                    'quantity_before' => $before,
                    'quantity_change' => $qty,
                    'quantity_after' => $after,
                    'cost_price_before' => $effectiveCost,
                    'cost_price_after' => $effectiveCost,
                    'inventory_value_before' => round($before * $effectiveCost, 2),
                    'inventory_value_after' => round($after * $effectiveCost, 2),
                    'remark' => $movementRemark,
                    'created_by_user_id' => $userId ?? $lockedOrder->created_by_user_id,
                ]);
            }

            if (! empty($messages)) {
                throw ValidationException::withMessages([
                    'items' => $messages,
                ])->status(422);
            }

            $lockedOrder->inventory_deducted_at = Carbon::now();
            $lockedOrder->save();

            return true;
        });
    }
}
