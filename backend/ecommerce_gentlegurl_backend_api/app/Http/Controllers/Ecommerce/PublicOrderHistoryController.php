<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use Illuminate\Http\Request;

class PublicOrderHistoryController extends Controller
{
    public function index(Request $request)
    {
        $customer = $request->user('customer');
        $perPage = $request->integer('per_page', 10);

        $orders = Order::where('customer_id', $customer->id)
            ->with(['items.product'])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $data = [
            'orders' => collect($orders->items())->map(fn(Order $order) => [
                'id' => $order->id,
                'order_no' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'grand_total' => $order->grand_total,
                'created_at' => $order->created_at?->toDateTimeString(),
                'items' => $order->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_slug' => $item->product?->slug,
                        'name' => $item->product_name_snapshot,
                        'sku' => $item->sku_snapshot,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->price_snapshot,
                        'line_total' => $item->line_total,
                    ];
                })->values(),
            ])->all(),
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
                'from' => $orders->firstItem(),
                'to' => $orders->lastItem(),
            ],
        ];

        return $this->respond($data);
    }

    public function show(Request $request, Order $order)
    {
        $customer = $request->user('customer');

        if ($order->customer_id !== $customer->id) {
            abort(404);
        }

        $order->load(['items', 'voucher', 'uploads', 'returns']);

        $data = [
            'order' => [
                'id' => $order->id,
                'order_no' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'subtotal' => $order->subtotal,
                'discount_total' => $order->discount_total,
                'shipping_fee' => $order->shipping_fee,
                'grand_total' => $order->grand_total,
                'items' => $order->items->map(function ($item) {
                    return [
                        'product_id' => $item->product_id,
                        'name' => $item->product_name_snapshot,
                        'sku' => $item->sku_snapshot,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->price_snapshot,
                        'line_total' => $item->line_total,
                    ];
                }),
                'voucher' => $order->voucher ? [
                    'code' => $order->voucher->code_snapshot,
                    'discount_amount' => $order->voucher->discount_amount,
                ] : null,
                'slips' => $order->uploads
                    ->where('type', 'payment_slip')
                    ->map(fn($upload) => [
                        'type' => $upload->type,
                        'file_url' => $upload->file_url,
                    ])
                    ->values(),
                'returns' => $order->returns->map(fn($returnRequest) => [
                    'id' => $returnRequest->id,
                    'status' => $returnRequest->status,
                    'tracking_no' => $returnRequest->return_tracking_no,
                ]),
            ],
        ];

        return $this->respond($data);
    }
}
