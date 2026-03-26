<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use Illuminate\Validation\ValidationException;

class OrderInventoryService
{
    public function deductForOrder(Order $order): void
    {
        $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();

        if ($lockedOrder->inventory_deducted_at !== null) {
            return;
        }

        $items = $lockedOrder->items()
            ->whereNotNull('product_id')
            ->where(function ($query) {
                $query->whereNull('line_type')
                    ->orWhere('line_type', 'product');
            })
            ->where(function ($query) {
                $query->whereNull('is_reward')
                    ->orWhere('is_reward', false);
            })
            ->get();

        foreach ($items as $item) {
            $requested = (int) ($item->quantity ?? 0);
            if ($requested <= 0) {
                continue;
            }

            if ($item->product_variant_id) {
                $variant = ProductVariant::with('bundleItems.componentVariant')
                    ->whereKey($item->product_variant_id)
                    ->where('product_id', $item->product_id)
                    ->lockForUpdate()
                    ->first();

                if (! $variant) {
                    throw ValidationException::withMessages([
                        'items' => ["Selected variant is invalid for item #{$item->id}."],
                    ])->status(422);
                }

                if ($variant->is_bundle) {
                    $this->deductBundleVariant($lockedOrder, $variant, $requested);
                    continue;
                }

                $this->deductSingleVariant($lockedOrder, $variant, $requested);
                continue;
            }

            $this->deductSimpleProduct($lockedOrder, (int) $item->product_id, $requested);
        }

        $lockedOrder->inventory_deducted_at = now();
        $lockedOrder->save();
    }

    private function deductBundleVariant(Order $order, ProductVariant $bundleVariant, int $orderedQty): void
    {
        $bundleVariant->loadMissing('bundleItems.componentVariant');

        foreach ($bundleVariant->bundleItems as $bundleItem) {
            $componentId = (int) ($bundleItem->component_variant_id ?? 0);
            if (! $componentId) {
                continue;
            }

            $component = ProductVariant::whereKey($componentId)->lockForUpdate()->first();
            if (! $component || ! $component->track_stock) {
                continue;
            }

            $required = max(1, (int) ($bundleItem->quantity ?? 1)) * $orderedQty;
            $available = (int) ($component->stock ?? 0);

            if ($required > $available) {
                throw ValidationException::withMessages([
                    'items' => [
                        __('Insufficient stock for bundle component :name. Required: :required, available: :available.', [
                            'name' => $component->title ?? 'variant',
                            'required' => $required,
                            'available' => $available,
                        ]),
                    ],
                ])->status(422);
            }

            $beforeCost = (float) ($component->cost_price ?? 0);
            $beforeInventory = round($available * $beforeCost, 2);
            $afterQty = $available - $required;
            $afterInventory = round(max(0, $beforeInventory - ($required * $beforeCost)), 2);

            $component->stock = $afterQty;
            $component->save();

            ProductStockMovement::create([
                'product_id' => $component->product_id,
                'product_variant_id' => $component->id,
                'type' => 'sale_out',
                'quantity_before' => $available,
                'quantity_change' => $required,
                'quantity_after' => $afterQty,
                'cost_price_before' => $beforeCost,
                'cost_price_after' => $beforeCost,
                'inventory_value_before' => $beforeInventory,
                'inventory_value_after' => $afterInventory,
                'remark' => 'Order checkout deduction #' . $order->order_number,
                'created_by_user_id' => $order->created_by_user_id,
            ]);
        }
    }

    private function deductSingleVariant(Order $order, ProductVariant $variant, int $requested): void
    {
        if (! $variant->track_stock) {
            return;
        }

        $beforeQty = (int) ($variant->stock ?? 0);

        if ($requested > $beforeQty) {
            throw ValidationException::withMessages([
                'items' => [
                    __('Insufficient stock for variant :name. Required: :required, available: :available.', [
                        'name' => $variant->title ?? 'variant',
                        'required' => $requested,
                        'available' => $beforeQty,
                    ]),
                ],
            ])->status(422);
        }

        $beforeCost = (float) ($variant->cost_price ?? 0);
        $beforeInventory = round($beforeQty * $beforeCost, 2);
        $afterQty = $beforeQty - $requested;
        $afterInventory = round(max(0, $beforeInventory - ($requested * $beforeCost)), 2);

        $variant->stock = $afterQty;
        $variant->save();

        ProductStockMovement::create([
            'product_id' => $variant->product_id,
            'product_variant_id' => $variant->id,
            'type' => 'sale_out',
            'quantity_before' => $beforeQty,
            'quantity_change' => $requested,
            'quantity_after' => $afterQty,
            'cost_price_before' => $beforeCost,
            'cost_price_after' => $beforeCost,
            'inventory_value_before' => $beforeInventory,
            'inventory_value_after' => $afterInventory,
            'remark' => 'Order checkout deduction #' . $order->order_number,
            'created_by_user_id' => $order->created_by_user_id,
        ]);
    }

    private function deductSimpleProduct(Order $order, int $productId, int $requested): void
    {
        $product = Product::whereKey($productId)->lockForUpdate()->first();

        if (! $product || ! $product->track_stock) {
            return;
        }

        $beforeQty = (int) ($product->stock_quantity ?? $product->stock ?? 0);
        if ($requested > $beforeQty) {
            throw ValidationException::withMessages([
                'items' => [
                    __('Insufficient stock for product :name. Required: :required, available: :available.', [
                        'name' => $product->name ?? 'product',
                        'required' => $requested,
                        'available' => $beforeQty,
                    ]),
                ],
            ])->status(422);
        }

        $beforeCost = (float) ($product->cost_price ?? 0);
        $beforeInventory = round($beforeQty * $beforeCost, 2);
        $afterQty = $beforeQty - $requested;
        $afterInventory = round(max(0, $beforeInventory - ($requested * $beforeCost)), 2);

        $product->stock = $afterQty;
        $product->stock_quantity = $afterQty;
        $product->inventory_value = $afterInventory;
        $product->save();

        ProductStockMovement::create([
            'product_id' => $product->id,
            'product_variant_id' => null,
            'type' => 'sale_out',
            'quantity_before' => $beforeQty,
            'quantity_change' => $requested,
            'quantity_after' => $afterQty,
            'cost_price_before' => $beforeCost,
            'cost_price_after' => $beforeCost,
            'inventory_value_before' => $beforeInventory,
            'inventory_value_after' => $afterInventory,
            'remark' => 'Order checkout deduction #' . $order->order_number,
            'created_by_user_id' => $order->created_by_user_id,
        ]);
    }
}
