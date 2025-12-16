<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Cart;
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

        $item = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->first();

        if ($quantity === 0) {
            $item?->delete();
        } else {
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

    public function removeItem(Request $request, CartItem $item)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : $request->query('session_token');

        $result = $this->cartService->findOrCreateCart($customer, $sessionToken);
        $cart = $result['cart'];

        if ($item->cart_id !== $cart->id) {
            return $this->respond(null, __('Item not found in this cart.'), false, 404);
        }

        $item->delete();

        return $this->respond($this->cartService->formatCart($cart->fresh()));
    }

    public function merge(Request $request)
    {
        $sessionToken = $request->input('session_token');

        if (!$sessionToken) {
            return $this->respondError('session_token is required.');
        }

        $customer = $this->currentCustomer();

        if (!$customer) {
            return $this->respondError('Login required to merge cart.', 401);
        }

        $guestCart = Cart::where('session_token', $sessionToken)
            ->where('status', 'open')
            ->first();

        if (!$guestCart || $guestCart->items->isEmpty()) {
            return $this->respond([
                'message' => 'Nothing to merge.',
                'merged_items' => [],
            ]);
        }

        $customerCart = Cart::firstOrCreate(
            ['customer_id' => $customer->id, 'status' => 'open'],
            ['session_token' => null]
        );

        foreach ($guestCart->items as $item) {
            $existing = $customerCart->items()
                ->where('product_id', $item->product_id)
                ->first();

            if ($existing) {
                $existing->quantity += $item->quantity;
                $existing->save();
            } else {
                $customerCart->items()->create([
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                ]);
            }
        }

        $guestCart->status = 'merged';
        $guestCart->save();

        $guestCart->items()->delete();

        return $this->respond([
            'message' => 'Cart merged successfully',
            'customer_cart_id' => $customerCart->id,
        ]);
    }

    public function reset(Request $request)
    {
        $sessionToken = $request->input('session_token') ?? $request->query('session_token');

        $cart = $this->cartService->resetGuestCart($sessionToken);

        return $this->respond($this->cartService->formatCart($cart));
    }
}
