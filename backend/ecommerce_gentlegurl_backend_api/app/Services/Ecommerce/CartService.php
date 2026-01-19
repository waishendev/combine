<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Cart;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Customer;
use App\Support\Pricing\ProductPricing;
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
            $product = $item->product;
            $variant = $item->productVariant;
            $pricing = (!$item->is_reward && $product)
                ? ProductPricing::build($product, $variant)
                : null;
            $effectivePrice = $pricing ? (float) $pricing['effective_price'] : (float) $item->unit_price_snapshot;
            $lineTotal = $effectivePrice * (int) $item->quantity;
            $priceChangeReason = $pricing
                ? ProductPricing::resolvePriceChangeReason((float) $item->unit_price_snapshot, $pricing)
                : null;

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
                    ? ($variant->is_bundle ? $variant->derivedAvailableQty() : ($variant->track_stock ? $variant->stock : null))
                    : ($product?->track_stock ? $product?->stock : null),
                'available_variants' => $product && $product->type === 'variant'
                    ? $product->variants->map(function ($productVariant) use ($product) {
                        $variantPricing = ProductPricing::build($product, $productVariant);
                        $derivedAvailableQty = $productVariant->is_bundle
                            ? $productVariant->derivedAvailableQty()
                            : null;

                        return [
                            'id' => $productVariant->id,
                            'name' => $productVariant->title,
                            'sku' => $productVariant->sku,
                            'price' => $productVariant->price,
                            'sale_price' => $productVariant->sale_price,
                            'sale_price_start_at' => $variantPricing['sale_price_start_at'],
                            'sale_price_end_at' => $variantPricing['sale_price_end_at'],
                            'original_price' => $variantPricing['original_price'],
                            'is_on_sale' => $variantPricing['is_on_sale'],
                            'effective_price' => $variantPricing['effective_price'],
                            'discount_percent' => $variantPricing['discount_percent'],
                            'stock' => $productVariant->is_bundle ? $derivedAvailableQty : $productVariant->stock,
                            'derived_available_qty' => $derivedAvailableQty,
                            'track_stock' => $productVariant->track_stock,
                            'is_active' => $productVariant->is_active,
                            'is_bundle' => $productVariant->is_bundle,
                            'image_url' => $productVariant->image_url,
                        ];
                    })->values()
                    : [],
                'quantity' => $item->quantity,
                'unit_price' => $effectivePrice,
                'line_total' => $lineTotal,
                'original_price' => $pricing['original_price'] ?? (float) $item->unit_price_snapshot,
                'sale_price' => $pricing['sale_price'] ?? null,
                'sale_price_start_at' => $pricing['sale_price_start_at'] ?? null,
                'sale_price_end_at' => $pricing['sale_price_end_at'] ?? null,
                'is_on_sale' => $pricing['is_on_sale'] ?? false,
                'effective_price' => $pricing['effective_price'] ?? (float) $item->unit_price_snapshot,
                'discount_percent' => $pricing['discount_percent'] ?? null,
                'price_changed' => $priceChangeReason !== null,
                'price_change_reason' => $priceChangeReason,
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
