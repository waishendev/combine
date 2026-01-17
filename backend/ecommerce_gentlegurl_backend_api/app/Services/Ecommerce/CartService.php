<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Cart;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Customer;
use Illuminate\Support\Facades\Storage;
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
        $cart->load(['items.product.images', 'items.product.variants', 'items.productVariant']);

        $items = $cart->items->map(function ($item) {
            $lineTotal = (float) $item->unit_price_snapshot * (int) $item->quantity;

            $product = $item->product;
            $variant = $item->productVariant;
            $thumbnail = $variant?->image_url ?? $product?->cover_image_url;
            if (!$thumbnail) {
                $legacyImage = $product?->image_url ?? $product?->image_path ?? null;
                $thumbnail = $this->resolveImageUrl($legacyImage);
            }

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_variant_id' => $item->product_variant_id,
                'product_type' => $product?->type,
                'product_name' => $product?->name,
                'variant_name' => $variant?->title,
                'variant_sku' => $variant?->sku,
                'product_slug' => $product?->slug,
                'product_image' => $thumbnail,
                'product_stock' => $variant
                    ? ($variant->track_stock ? $variant->stock : null)
                    : ($product?->track_stock ? $product?->stock : null),
                'available_variants' => $product && $product->type === 'variant'
                    ? $product->variants->map(fn($productVariant) => [
                        'id' => $productVariant->id,
                        'name' => $productVariant->title,
                        'sku' => $productVariant->sku,
                        'price' => $productVariant->price,
                        'sale_price' => $productVariant->sale_price,
                        'stock' => $productVariant->stock,
                        'track_stock' => $productVariant->track_stock,
                        'is_active' => $productVariant->is_active,
                        'image_url' => $productVariant->image_url,
                    ])->values()
                    : [],
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price_snapshot,
                'line_total' => $lineTotal,
                'is_reward' => (bool) $item->is_reward,
                'reward_redemption_id' => $item->reward_redemption_id,
                'locked' => (bool) $item->locked,
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

    private function resolveImageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return Storage::disk('public')->url($path);
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

        $customerItems = $customerCart->items()
            ->get()
            ->keyBy(fn($item) => sprintf('%s:%s', $item->product_id, $item->product_variant_id ?? ''));

        foreach ($guestCart->items as $guestItem) {
            $key = sprintf('%s:%s', $guestItem->product_id, $guestItem->product_variant_id ?? '');
            if ($customerItems->has($key)) {
                /** @var CartItem $item */
                $item = $customerItems->get($key);
                $item->quantity += $guestItem->quantity;
                $item->save();
            } else {
                $customerCart->items()->create([
                    'product_id' => $guestItem->product_id,
                    'product_variant_id' => $guestItem->product_variant_id,
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
}
