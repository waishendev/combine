<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Product;
use App\Services\Ecommerce\CartService;
use Illuminate\Http\Request;

class PublicCartController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(protected CartService $cartService)
    {
    }

    public function show(Request $request)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : $request->query('session_token');

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);

        return $this->respond($this->cartService->formatCart($result['cart']));
    }

    public function addOrUpdateItem(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:0'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token'));

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        $product = Product::find($validated['product_id']);
        $quantity = (int) $validated['quantity'];

        if (!$product || $product->is_reward_only) {
            return $this->respondError(__('This product cannot be added to cart.'), 422);
        }

        $item = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->first();

        if ($item?->locked) {
            return $this->respondError(__('This reward item cannot be modified from cart.'), 422);
        }

        if ($quantity === 0) {
            $item?->delete();
        } else {
            if ($product->stock !== null && $quantity > (int) $product->stock) {
                return $this->respondError(__('Insufficient stock. Max available: :stock', ['stock' => (int) $product->stock]), 422);
            }

            if ($item) {
                $item->update([
                    'quantity' => $quantity,
                    'unit_price_snapshot' => $product->price,
                ]);
            } else {
                CartItem::create([
                    'cart_id' => $cart->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price_snapshot' => $product->price,
                ]);
            }
        }

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function addItemIncrement(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token'));

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        $product = Product::find($validated['product_id']);
        $delta = (int) $validated['quantity'];

        if (!$product || $product->is_reward_only) {
            return $this->respondError(__('This product cannot be added to cart.'), 422);
        }

        $item = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->first();

        if ($item?->locked) {
            return $this->respondError(__('This reward item cannot be modified from cart.'), 422);
        }

        $newQuantity = $delta + (int) ($item?->quantity ?? 0);

        if ($product->stock !== null && $newQuantity > (int) $product->stock) {
            return $this->respondError(__('Insufficient stock. Max available: :stock', ['stock' => (int) $product->stock]), 422);
        }

        if ($newQuantity <= 0) {
            $item?->delete();
        } elseif ($item) {
            $item->update([
                'quantity' => $newQuantity,
                'unit_price_snapshot' => $product->price,
            ]);
        } else {
            CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'quantity' => $newQuantity,
                'unit_price_snapshot' => $product->price,
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
}
