<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class OrderReserveService
{
    public function getReserveMinutes(): int
    {
        $value = SettingService::get('ecommerce.order_reserve_minutes', 30);

        if (is_array($value)) {
            $value = data_get($value, 'minutes', data_get($value, 'value', 30));
        }

        $minutes = (int) $value;

        return $minutes > 0 ? $minutes : 30;
    }

    public function getReserveExpiresAt(Order $order): Carbon
    {
        $base = $order->created_at ? $order->created_at->copy() : Carbon::now();

        return $base->addMinutes($this->getReserveMinutes());
    }

    public function isExpired(Order $order): bool
    {
        return $this->getReserveExpiresAt($order)->isPast();
    }  
    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function validateStockForItems(array $items): void
    {
        $normalItems = collect($items)
            ->filter(fn($item) => empty($item['is_reward']))
            ->values();

        if ($normalItems->isEmpty()) {
            return;
        }

        $products = Product::whereIn('id', $normalItems->pluck('product_id'))
            ->get()
            ->keyBy('id');
        $variants = ProductVariant::with(['bundleItems.componentVariant'])
            ->whereIn('id', $normalItems->pluck('product_variant_id')->filter())
            ->get()
            ->keyBy('id');

        $errors = [];

        foreach ($normalItems as $item) {
            $product = $products->get($item['product_id']);
            if (!$product) {
                continue;
            }

            $requested = (int) ($item['quantity'] ?? 0);
            $variantId = $item['product_variant_id'] ?? null;

            if ($variantId) {
                $variant = $variants->get($variantId);
                if (! $variant) {
                    continue;
                }

                if ($variant->is_bundle) {
                    $variant->loadMissing('bundleItems.componentVariant');
                    foreach ($variant->bundleItems as $bundleItem) {
                        $component = $bundleItem->componentVariant;
                        if (! $component || ! $component->track_stock) {
                            continue;
                        }
                        $required = (int) ($bundleItem->quantity ?? 1) * $requested;
                        $available = (int) ($component->stock ?? 0);
                        if ($required > $available) {
                            $errors[] = __('Bundle option is out of stock (component insufficient): :variant_name', [
                                'variant_name' => $component->title ?? 'variant',
                            ]);
                        }
                    }
                    continue;
                }

                if (! $variant->track_stock) {
                    continue;
                }

                $available = (int) ($variant->stock ?? 0);
                if ($requested > $available) {
                    $errors[] = sprintf(
                        'Insufficient stock for %s (ID %d). Max available: %d.',
                        $variant->title ?? 'variant',
                        $variant->id,
                        $available
                    );
                }
                continue;
            }

            if (! $product->track_stock) {
                continue;
            }

            $available = (int) ($product->stock ?? 0);

            if ($requested > $available) {
                $errors[] = sprintf(
                    'Insufficient stock for %s (ID %d). Max available: %d.',
                    $product->name ?? 'product',
                    $product->id,
                    $available
                );
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages([
                'items' => $errors,
            ])->status(422);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function reserveStockForItems(array $items): void
    {
        foreach ($items as $item) {
            if (!empty($item['is_reward'])) {
                continue;
            }

            $productId = (int) ($item['product_id'] ?? 0);
            if (!$productId) {
                continue;
            }

            $variantId = (int) ($item['product_variant_id'] ?? 0);
            if ($variantId) {
                $variant = ProductVariant::with('bundleItems.componentVariant')
                    ->where('id', $variantId)
                    ->lockForUpdate()
                    ->first();
                if (! $variant) {
                    continue;
                }

                $requested = (int) ($item['quantity'] ?? 0);

                if ($variant->is_bundle) {
                    foreach ($variant->bundleItems as $bundleItem) {
                        $component = $bundleItem->componentVariant;
                        if (! $component || ! $component->track_stock) {
                            continue;
                        }
                        $required = (int) ($bundleItem->quantity ?? 1) * $requested;
                        $componentVariant = ProductVariant::where('id', $component->id)->lockForUpdate()->first();
                        if (! $componentVariant) {
                            continue;
                        }
                        $available = (int) ($componentVariant->stock ?? 0);
                        if ($required > $available) {
                            throw ValidationException::withMessages([
                                'items' => [
                                    __('Bundle option is out of stock (component insufficient): :variant_name', [
                                        'variant_name' => $componentVariant->title ?? 'variant',
                                    ]),
                                ],
                            ])->status(422);
                        }
                        $componentVariant->stock = $available - $required;
                        $componentVariant->save();
                    }
                    continue;
                }

                if (! $variant->track_stock) {
                    continue;
                }

                $available = (int) ($variant->stock ?? 0);

                if ($requested > $available) {
                    throw ValidationException::withMessages([
                        'items' => [
                            sprintf(
                                'Insufficient stock for %s (ID %d). Max available: %d.',
                                $variant->title ?? 'variant',
                                $variant->id,
                                $available
                            ),
                        ],
                    ])->status(422);
                }

                $variant->stock = $available - $requested;
                $variant->save();
                continue;
            }

            $product = Product::where('id', $productId)->lockForUpdate()->first();
            if (!$product || ! $product->track_stock) {
                continue;
            }

            $available = (int) ($product->stock ?? 0);
            $requested = (int) ($item['quantity'] ?? 0);

            if ($requested > $available) {
                throw ValidationException::withMessages([
                    'items' => [
                        sprintf(
                            'Insufficient stock for %s (ID %d). Max available: %d.',
                            $product->name ?? 'product',
                            $product->id,
                            $available
                        ),
                    ],
                ])->status(422);
            }

            $product->stock = $available - $requested;
            $product->save();
        }
    }

    public function releaseStockForOrder(Order $order): void
    {
        $order->loadMissing('items');

        foreach ($order->items as $item) {
            if ($item->is_reward) {
                continue;
            }

            if ($item->product_variant_id) {
                $variant = ProductVariant::with('bundleItems.componentVariant')
                    ->where('id', $item->product_variant_id)
                    ->lockForUpdate()
                    ->first();
                if (! $variant) {
                    continue;
                }

                if ($variant->is_bundle) {
                    foreach ($variant->bundleItems as $bundleItem) {
                        $component = $bundleItem->componentVariant;
                        if (! $component || ! $component->track_stock) {
                            continue;
                        }
                        $componentVariant = ProductVariant::where('id', $component->id)->lockForUpdate()->first();
                        if (! $componentVariant) {
                            continue;
                        }
                        $restock = (int) ($bundleItem->quantity ?? 1) * (int) $item->quantity;
                        $componentVariant->stock = (int) ($componentVariant->stock ?? 0) + $restock;
                        $componentVariant->save();
                    }
                    continue;
                }

                if ($variant->track_stock) {
                    $variant->stock = (int) ($variant->stock ?? 0) + (int) $item->quantity;
                    $variant->save();
                }
                continue;
            }

            $product = Product::where('id', $item->product_id)->lockForUpdate()->first();
            if (!$product || ! $product->track_stock) {
                continue;
            }

            $product->stock = (int) ($product->stock ?? 0) + (int) $item->quantity;
            $product->save();
        }
    }
}
