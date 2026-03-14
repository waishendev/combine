<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Services\Ecommerce\CartService;
use App\Services\Ecommerce\PromotionPricingService;
use App\Support\Pricing\ProductPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PublicCartController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(
        protected CartService $cartService,
        protected PromotionPricingService $promotionPricingService,
    )
    {
    }

    public function show(Request $request)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : $request->query('session_token');

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);

        return $this->respond($this->cartService->formatCart($result['cart']));
    }


    public function calculate(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.cart_item_id' => ['nullable', 'integer'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $itemsForPricing = [];

        foreach ($validated['items'] as $index => $item) {
            $product = Product::find((int) $item['product_id']);
            if (! $product || ! $product->is_active || $product->is_reward_only) {
                continue;
            }

            $variant = $this->resolveVariant($product, $item['product_variant_id'] ?? null);
            $pricing = ProductPricing::build($product, $variant);

            $itemsForPricing[] = [
                'item_key' => (string) $index,
                'cart_item_id' => $item['cart_item_id'] ?? null,
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'name' => $product->name,
                'unit_price' => (float) ($pricing['effective_price'] ?? 0),
                'quantity' => (int) ($item['quantity'] ?? 1),
            ];
        }

        $pricing = $this->promotionPricingService->calculate($itemsForPricing);

        Log::info('shop.cart.calculate.promotion_pricing', [
            'items_count' => count($itemsForPricing),
            'items' => $itemsForPricing,
            'promotion_summary' => $pricing['promotion_summary'] ?? null,
            'promotion_discount' => $pricing['promotion_discount'] ?? 0,
            'final_total' => $pricing['final_total'] ?? 0,
        ]);

        return $this->respond([
            'items' => collect($pricing['items'])->map(fn (array $priced) => [
                'item_key' => $priced['item_key'] ?? null,
                'cart_item_id' => $priced['cart_item_id'] ?? null,
                'product_id' => (int) $priced['product_id'],
                'product_variant_id' => $priced['product_variant_id'] ?? null,
                'name' => $priced['name'] ?? null,
                'unit_price' => (float) $priced['unit_price'],
                'quantity' => (int) $priced['quantity'],
                'line_total' => (float) $priced['line_total'],
                'promotion_applied' => (bool) $priced['promotion_applied'],
                'promotion_name' => $priced['promotion_name'] ?? null,
                'promotion_discount_amount' => (float) ($priced['promotion_discount_amount'] ?? 0),
                'line_total_after_promotion' => (float) ($priced['line_total_after_promotion'] ?? $priced['line_total']),
            ])->values(),
            'promotion_summary' => $pricing['promotion_summary'],
            'promotions' => $pricing['promotions'],
            'subtotal' => (float) $pricing['subtotal'],
            'promotion_discount' => (float) $pricing['promotion_discount'],
            'final_total' => (float) $pricing['final_total'],
        ]);
    }

    public function addOrUpdateItem(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'integer', 'min:0'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token'));

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        $product = Product::find($validated['product_id']);
        $quantity = (int) $validated['quantity'];
        $variantId = $validated['product_variant_id'] ?? null;
        $variant = $this->resolveVariant($product, $variantId);

        if (!$product || $product->is_reward_only) {
            return $this->respondError(__('This product cannot be added to cart.'), 422);
        }

        $item = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->when($variant, fn($query) => $query->where('product_variant_id', $variant->id))
            ->when(!$variant, fn($query) => $query->whereNull('product_variant_id'))
            ->first();

        if ($item?->locked) {
            return $this->respondError(__('This reward item cannot be modified from cart.'), 422);
        }

        if ($quantity === 0) {
            $item?->delete();
        } else {
            $availableStock = $this->resolveStock($product, $variant);
            if ($availableStock !== null && $quantity > $availableStock) {
                return $this->respondError(__('Insufficient stock. Max available: :stock', ['stock' => $availableStock]), 422);
            }

            $unitPrice = $this->resolvePrice($product, $variant);

            if ($item) {
                $item->update([
                    'quantity' => $quantity,
                    'unit_price_snapshot' => $unitPrice,
                ]);
            } else {
                CartItem::create([
                    'cart_id' => $cart->id,
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'quantity' => $quantity,
                    'unit_price_snapshot' => $unitPrice,
                ]);
            }
        }

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function addItemIncrement(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token'));

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        $product = Product::find($validated['product_id']);
        $delta = (int) $validated['quantity'];
        $variantId = $validated['product_variant_id'] ?? null;
        $variant = $this->resolveVariant($product, $variantId);

        if (!$product || $product->is_reward_only) {
            return $this->respondError(__('This product cannot be added to cart.'), 422);
        }

        $item = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->when($variant, fn($query) => $query->where('product_variant_id', $variant->id))
            ->when(!$variant, fn($query) => $query->whereNull('product_variant_id'))
            ->first();

        if ($item?->locked) {
            return $this->respondError(__('This reward item cannot be modified from cart.'), 422);
        }

        $newQuantity = $delta + (int) ($item?->quantity ?? 0);

        $availableStock = $this->resolveStock($product, $variant);
        if ($availableStock !== null && $newQuantity > $availableStock) {
            return $this->respondError(__('Insufficient stock. Max available: :stock', ['stock' => $availableStock]), 422);
        }

        $unitPrice = $this->resolvePrice($product, $variant);

        if ($newQuantity <= 0) {
            $item?->delete();
        } elseif ($item) {
            $item->update([
                'quantity' => $newQuantity,
                'unit_price_snapshot' => $unitPrice,
            ]);
        } else {
            CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'quantity' => $newQuantity,
                'unit_price_snapshot' => $unitPrice,
            ]);
        }

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function removeItem(Request $request, CartItem $item)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : $request->query('session_token');

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        if ($item->cart_id !== $cart->id) {
            return $this->respond(null, __('Item not found in this cart.'), false, 404);
        }

        if ($item->locked) {
            return $this->respondError(__('This reward item is locked. Please cancel the reward instead.'), 422);
        }

        $item->delete();

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function updateItem(Request $request, CartItem $item)
    {
        $validated = $request->validate([
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token'));

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        if ($item->cart_id !== $cart->id) {
            return $this->respond(null, __('Item not found in this cart.'), false, 404);
        }

        if ($item->locked) {
            return $this->respondError(__('This reward item cannot be modified from cart.'), 422);
        }

        $product = $item->product;
        if (! $product || $product->is_reward_only) {
            return $this->respondError(__('This product cannot be updated.'), 422);
        }

        $variantId = $validated['product_variant_id'] ?? $item->product_variant_id;
        $variant = $variantId ? $this->resolveVariant($product, (int) $variantId) : null;

        if ($product->type === 'variant' && ! $variant) {
            return $this->respondError(__('Variant is required for this product.'), 422);
        }

        $quantity = (int) ($validated['quantity'] ?? $item->quantity);
        $availableStock = $this->resolveStock($product, $variant);
        if ($availableStock !== null && $quantity > $availableStock) {
            return $this->respondError(__('Insufficient stock. Max available: :stock', ['stock' => $availableStock]), 422);
        }

        $unitPrice = $this->resolvePrice($product, $variant);
        $existing = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->when($variant, fn($query) => $query->where('product_variant_id', $variant->id))
            ->when(!$variant, fn($query) => $query->whereNull('product_variant_id'))
            ->where('id', '!=', $item->id)
            ->first();

        if ($existing) {
            $existing->update([
                'quantity' => $quantity,
                'unit_price_snapshot' => $unitPrice,
            ]);
            $item->delete();
        } else {
            $item->update([
                'product_variant_id' => $variant?->id,
                'quantity' => $quantity,
                'unit_price_snapshot' => $unitPrice,
            ]);
        }

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function merge(Request $request)
    {
        $sessionToken = $request->input('session_token') ?? $request->query('session_token');

        if (!$sessionToken) {
            return $this->respondError('session_token is required.');
        }

        $customer = $this->currentCustomer();

        if (!$customer) {
            return $this->respondError('Login required to merge cart.', 401);
        }

        $mergedCart = $this->cartService->mergeGuestCartIntoCustomer($sessionToken, $customer);

        return $this->respond([
            'message' => 'Cart merged successfully',
            'customer_cart_id' => $mergedCart?->id,
        ]);
    }

    public function reset(Request $request)
    {
        $sessionToken = $request->input('session_token') ?? $request->query('session_token');

        $cart = $this->cartService->resetGuestCart($sessionToken);

        return $this->respond($this->cartService->formatCart($cart));
    }

    public function cancelRewardItem(Request $request, CartItem $item)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : $request->query('session_token');

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        if ($item->cart_id !== $cart->id || !$item->is_reward) {
            return $this->respond(null, __('Reward item not found in this cart.'), false, 404);
        }

        if ($item->reward_redemption_id) {
            $redemption = $item->redemption;
            if ($redemption && $redemption->status === 'pending') {
                $redemption->status = 'cancelled';
                $redemption->save();
            }
        }

        $item->delete();

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    protected function resolveVariant(?Product $product, ?int $variantId): ?ProductVariant
    {
        if (! $product) {
            return null;
        }

        if ($product->type !== 'variant') {
            return null;
        }

        if (! $variantId) {
            throw ValidationException::withMessages([
                'items' => [
                    [
                        'product_id' => $product->id,
                        'message' => __('Variant is required for this product.'),
                    ],
                ],
            ])->status(422);
        }

        $variant = ProductVariant::where('id', $variantId)
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->first();

        if (! $variant) {
            throw ValidationException::withMessages([
                'items' => [
                    [
                        'product_id' => $product->id,
                        'message' => __('Selected variant is not available.'),
                    ],
                ],
            ])->status(422);
        }

        return $variant;
    }

    protected function resolvePrice(Product $product, ?ProductVariant $variant): float
    {
        $pricing = ProductPricing::build($product, $variant);

        return (float) $pricing['effective_price'];
    }

    protected function resolveStock(Product $product, ?ProductVariant $variant): ?int
    {
        if ($variant) {
            if ($variant->is_bundle) {
                return $variant->derivedAvailableQty();
            }
            if (! $variant->track_stock) {
                return null;
            }
            return (int) ($variant->stock ?? 0);
        }

        if (! $product->track_stock) {
            return null;
        }

        return $product->stock !== null ? (int) $product->stock : null;
    }
}
