<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Cart;
use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\CartService;
use Illuminate\Http\Request;

class CartMergeController extends Controller
{
    public function __construct(protected CartService $cartService)
    {
    }

    public function merge(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'session_token' => ['required', 'string', 'max:100'],
        ]);

        $customer = Customer::findOrFail($validated['customer_id']);

        $cart = $this->cartService->mergeGuestCartIntoCustomer($validated['session_token'], $customer);

        return $this->respond($this->cartService->formatCart($cart ?? Cart::create([
            'customer_id' => $customer->id,
            'status' => 'open',
        ])));
    }
}
