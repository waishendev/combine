<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
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

        $errors = [];

        foreach ($normalItems as $item) {
            $product = $products->get($item['product_id']);
            if (!$product) {
                continue;
            }

            $available = (int) ($product->stock ?? 0);
            $requested = (int) ($item['quantity'] ?? 0);

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

            $product = Product::where('id', $productId)->lockForUpdate()->first();
            if (!$product) {
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

            $product = Product::where('id', $item->product_id)->lockForUpdate()->first();
            if (!$product) {
                continue;
            }

            $product->stock = (int) ($product->stock ?? 0) + (int) $item->quantity;
            $product->save();
        }
    }
}
