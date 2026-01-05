<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use Illuminate\Http\Request;

class PublicOrderTrackingController extends Controller
{
    public function track(Request $request)
    {
        $validated = $request->validate([
            'order_no' => ['required', 'string'],
        ]);

        $order = Order::with(['items.product.images', 'customer'])
            ->where('order_number', $validated['order_no'])
            ->first();

        if (! $order) {
            return $this->respond(null, __('Order not found or verification failed.'), false, 404);
        }

        $items = $order->items->map(function ($item) {
            $thumbnail = $item->product?->cover_image_url;

            return [
                'product_id' => $item->product_id,
                'product_name' => $item->product_name_snapshot ?? $item->product?->name,
                'product_slug' => $item->product?->slug,
                'product_image' => $thumbnail,
                'cover_image_url' => $thumbnail,
                'quantity' => $item->quantity,
                'unit_price' => $item->price_snapshot,
                'line_total' => $item->line_total,
            ];
        });

        $data = [
            'order_no' => $order->order_number,
            'status' => $order->status,
            'tracking_no' => $order->shipping_tracking_no,
            'courier' => $order->shipping_courier,
            'shipped_at' => $order->shipped_at?->toDateTimeString(),
            'shipping_method' => $order->pickup_or_shipping,
            'totals' => [
                'subtotal' => $order->subtotal,
                'discount_total' => $order->discount_total,
                'shipping_fee' => $order->shipping_fee,
                'grand_total' => $order->grand_total,
            ],
            'items' => $items,
        ];

        return $this->respond($data);
    }
}
