<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\OrderReceiptToken;
use Carbon\Carbon;

class PublicReceiptController extends Controller
{
    public function show(string $token)
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('token', $token)
            ->with(['order.items'])
            ->first();

        if (!$receiptToken) {
            return $this->respondError(__('Receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Receipt has expired.'), 410);
        }

        $order = $receiptToken->order;

        return $this->respond([
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'created_at' => $order->created_at,
            'subtotal' => $order->subtotal,
            'discount_total' => $order->discount_total,
            'shipping_fee' => $order->shipping_fee,
            'grand_total' => $order->grand_total,
            'items' => $order->items->map(fn ($item) => [
                'name' => $item->product_name_snapshot,
                'variant_name' => $item->variant_name_snapshot,
                'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot,
                'qty' => $item->quantity,
                'unit_price' => $item->price_snapshot,
                'line_total' => $item->line_total,
            ])->values(),
        ]);
    }
}
