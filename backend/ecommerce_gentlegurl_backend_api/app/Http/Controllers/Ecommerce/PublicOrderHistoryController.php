<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Services\Ecommerce\OrderReserveService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class PublicOrderHistoryController extends Controller
{
    public function __construct(protected OrderReserveService $orderReserveService)
    {
    }

    public function index(Request $request)
    {
        $customer = $request->user('customer');
        $perPage = $request->integer('per_page', 10);

        $orders = Order::where('customer_id', $customer->id)
            ->with(['items.product.images'])
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
                'reserve_expires_at' => $this->orderReserveService->getReserveExpiresAt($order)->toDateTimeString(),
                'items' => $order->items->map(function ($item) {
                    $images = $item->product?->images
                        ? $item->product->images
                            ->sortBy('id')
                            ->sortBy('sort_order')
                        : collect();

                    $thumbnail = optional(
                        $images->firstWhere('is_main', true) ?? $images->first()
                    )->image_path;

                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_slug' => $item->product?->slug,
                        'name' => $item->product_name_snapshot,
                        'sku' => $item->sku_snapshot,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->price_snapshot,
                        'line_total' => $item->line_total,
                        'product_image' => $thumbnail,
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

    public function showById(Request $request, int $id)
    {
        $customer = $request->user('customer');

        $order = Order::with([
            'items.product.images',
            'voucher',
            'uploads',
            'returns',
            'bankAccount',
            'pickupStore',
        ])
            ->where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $items = $order->items->map(function ($item) {
            $images = $item->product?->images
                ? $item->product->images
                    ->sortBy('id')
                    ->sortBy('sort_order')
                : collect();

            $thumbnail = optional(
                $images->firstWhere('is_main', true) ?? $images->first()
            )->image_path;

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_slug' => $item->product?->slug,
                'name' => $item->product_name_snapshot,
                'sku' => $item->sku_snapshot,
                'quantity' => $item->quantity,
                'unit_price' => $item->price_snapshot,
                'line_total' => $item->line_total,
                'product_image' => $thumbnail,
            ];
        })->values();

        $slips = $order->uploads
            ->where('type', 'payment_slip')
            ->map(fn($upload) => [
                'id' => $upload->id,
                'type' => $upload->type,
                'file_url' => $upload->file_url,
                'created_at' => $upload->created_at?->toDateTimeString(),
            ])
            ->values();

        $data = [
            'order' => [
                'id' => $order->id,
                'order_no' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'reserve_expires_at' => $this->orderReserveService->getReserveExpiresAt($order)->toDateTimeString(),
                'payment_method' => $order->payment_method,
                'payment_provider' => $order->payment_provider,
                'subtotal' => $order->subtotal,
                'discount_total' => $order->discount_total,
                'shipping_fee' => $order->shipping_fee,
                'grand_total' => $order->grand_total,
                'pickup_or_shipping' => $order->pickup_or_shipping,
                'shipping_courier' => $order->shipping_courier,
                'shipping_tracking_no' => $order->shipping_tracking_no,
                'shipped_at' => $order->shipped_at,
                'placed_at' => $order->placed_at,
                'paid_at' => $order->paid_at,
                'completed_at' => $order->completed_at,
                'items' => $items,
                'voucher' => $order->voucher ? [
                    'code' => $order->voucher->code_snapshot,
                    'discount_amount' => $order->voucher->discount_amount,
                ] : null,
                'slips' => $slips,
                'returns' => $order->returns->map(fn($returnRequest) => [
                    'id' => $returnRequest->id,
                    'status' => $returnRequest->status,
                    'tracking_no' => $returnRequest->return_tracking_no,
                ]),
                'shipping_address' => [
                    'name' => $order->shipping_name,
                    'phone' => $order->shipping_phone,
                    'line1' => $order->shipping_address_line1,
                    'line2' => $order->shipping_address_line2,
                    'city' => $order->shipping_city,
                    'state' => $order->shipping_state,
                    'postcode' => $order->shipping_postcode,
                    'country' => $order->shipping_country,
                ],
                'pickup_store' => $order->pickupStore ? [
                    'id' => $order->pickupStore->id,
                    'name' => $order->pickupStore->name,
                    'address_line1' => $order->pickupStore->address_line1,
                    'address_line2' => $order->pickupStore->address_line2,
                    'city' => $order->pickupStore->city,
                    'state' => $order->pickupStore->state,
                    'postcode' => $order->pickupStore->postcode,
                    'country' => $order->pickupStore->country,
                    'phone' => $order->pickupStore->phone,
                ] : null,
                'bank_account' => $order->bankAccount ? [
                    'id' => $order->bankAccount->id,
                    'bank_name' => $order->bankAccount->bank_name,
                    'account_name' => $order->bankAccount->account_name,
                    'account_number' => $order->bankAccount->account_number,
                    'branch' => $order->bankAccount->branch,
                    'logo_url' => $order->bankAccount->logo_url,
                    'qr_image_url' => $order->bankAccount->qr_image_url,
                ] : null,
            ],
        ];

        return $this->respond($data);
    }

    public function cancel(Request $request, Order $order)
    {
        $customer = $request->user('customer');

        if ($order->customer_id !== $customer->id) {
            return $this->respondError(__('Order not found.'), 404);
        }

        if ($order->status !== 'pending' || $order->payment_status !== 'unpaid') {
            return $this->respondError(__('Order cannot be cancelled.'), 422);
        }

        if ($this->orderReserveService->isExpired($order)) {
            return $this->respondError(__('Order reservation has expired.'), 422);
        }

        DB::transaction(function () use ($order) {
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();

            if (!$lockedOrder || $lockedOrder->status !== 'pending' || $lockedOrder->payment_status !== 'unpaid') {
                return;
            }

            if ($this->orderReserveService->isExpired($lockedOrder)) {
                return;
            }

            $lockedOrder->status = 'cancelled';
            $lockedOrder->save();

            $this->orderReserveService->releaseStockForOrder($lockedOrder);
        });

        $order->refresh();

        return $this->respond([
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'reserve_expires_at' => $this->orderReserveService->getReserveExpiresAt($order)->toDateTimeString(),
            ],
        ]);
    }
}
