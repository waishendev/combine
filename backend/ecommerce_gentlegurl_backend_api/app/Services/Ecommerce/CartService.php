<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Cart;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Customer;
use Illuminate\Support\Str;

class CartService
{
    public function findOrCreateCart(?Customer $customer, ?string $sessionToken): array
    {
        $cart = null;

        if ($customer?->id) {
            $cart = Cart::where('customer_id', $customer->id)
                ->where('status', 'open')
                ->first();

            if (!$cart) {
                $cart = Cart::create([
                    'customer_id' => $customer->id,
                    'status' => 'open',
                ]);
            }

            return ['cart' => $cart, 'session_token' => null];
        }

        if ($sessionToken) {
            $cart = Cart::where('session_token', $sessionToken)
                ->where('status', 'open')
                ->whereNull('customer_id')
                ->first();
        }

        if (!$cart) {
            $sessionToken = $sessionToken ?: (string) Str::uuid();
            $cart = Cart::create([
                'session_token' => $sessionToken,
                'status' => 'open',
            ]);
        }

        return ['cart' => $cart, 'session_token' => $cart->session_token];
    }

    public function formatCart(Cart $cart): array
    {
        $cart->load(['items.product.images']);

        $items = $cart->items->map(function ($item) {
            $lineTotal = (float) $item->unit_price_snapshot * (int) $item->quantity;

            $images = $item->product?->images
                ? $item->product->images
                    ->sortBy('id')
                    ->sortBy('sort_order')
                : collect();

            $thumbnail = optional(
                $images->firstWhere('is_main', true) ?? $images->first()
            )->image_path;

            $thumbnailUrl = $thumbnail ? url($thumbnail) : null;

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name,
                'product_slug' => $item->product?->slug,
                'product_image' => $thumbnailUrl ?? $thumbnail,
                'product_image_url' => $thumbnailUrl ?? $thumbnail,
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price_snapshot,
                'line_total' => $lineTotal,
            ];
        })->values();

        return [
            'session_token' => $cart->session_token,
            'customer_id' => $cart->customer_id,
            'items' => $items,
            'totals' => [
                'items_count' => $items->sum('quantity'),
                'subtotal' => $items->sum(fn($item) => $item['line_total']),
            ],
        ];
    }

    public function mergeGuestCartIntoCustomer(string $sessionToken, Customer $customer): ?Cart
    {
        $guestCart = Cart::where('session_token', $sessionToken)
            ->whereNull('customer_id')
            ->where('status', 'open')
            ->first();

        $customerCart = Cart::where('customer_id', $customer->id)
            ->where('status', 'open')
            ->first();

        if (!$guestCart) {
            if (!$customerCart) {
                $customerCart = Cart::create([
                    'customer_id' => $customer->id,
                    'status' => 'open',
                ]);
            }

            return $customerCart;
        }

        if (!$customerCart) {
            $guestCart->customer_id = $customer->id;
            $guestCart->save();

            return $guestCart;
        }

        $customerItems = $customerCart->items()->get()->keyBy('product_id');

        foreach ($guestCart->items as $guestItem) {
            if ($customerItems->has($guestItem->product_id)) {
                /** @var CartItem $item */
                $item = $customerItems->get($guestItem->product_id);
                $item->quantity += $guestItem->quantity;
                $item->save();
            } else {
                $customerCart->items()->create([
                    'product_id' => $guestItem->product_id,
                    'quantity' => $guestItem->quantity,
                    'unit_price_snapshot' => $guestItem->unit_price_snapshot,
                ]);
            }
        }

        $guestCart->status = 'merged';
        $guestCart->session_token = null;
        $guestCart->save();
        $guestCart->items()->delete();

        return $customerCart->fresh();
    }

    public function resetGuestCart(?string $sessionToken): Cart
    {
        if ($sessionToken) {
            $cart = Cart::where('session_token', $sessionToken)
                ->whereNull('customer_id')
                ->where('status', 'open')
                ->first();

            if ($cart) {
                $cart->items()->delete();
                $cart->status = 'reset';
                $cart->save();
            }
        }

        $newToken = (string) Str::uuid();

        return Cart::create([
            'session_token' => $newToken,
            'status' => 'open',
        ]);
    }

    public function removeItemsFromCart(?Customer $customer, ?string $sessionToken, array $productIds): void
    {
        if (empty($productIds)) {
            return;
        }

        $cartQuery = Cart::query()
            ->where('status', 'open');

        if ($customer?->id) {
            $cartQuery->where('customer_id', $customer->id);
        } elseif ($sessionToken) {
            $cartQuery->where('session_token', $sessionToken);
        } else {
            return;
        }

        $cart = $cartQuery->first();

        if (!$cart) {
            return;
        }

        $cart->items()
            ->whereIn('product_id', $productIds)
            ->delete();

        if ($cart->items()->count() === 0) {
            $cart->status = 'converted';
            $cart->save();
        }
    }
}
