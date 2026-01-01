<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Services\Ecommerce\OrderReserveService;
use App\Services\Ecommerce\InvoiceService;
use App\Services\SettingService;
use App\Services\BillplzService;
use App\Models\BillplzBill;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class PublicOrderHistoryController extends Controller
{
    public function __construct(
        protected OrderReserveService $orderReserveService,
        protected BillplzService $billplzService,
        protected InvoiceService $invoiceService,
    )
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
                'payment_method' => $order->payment_method,
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
                'return_window_days' => (int) SettingService::get('ecommerce.return_window_days', 7),
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
                'billing_same_as_shipping' => $order->billing_same_as_shipping,
                'billing_address' => [
                    'name' => $order->billing_name,
                    'phone' => $order->billing_phone,
                    'line1' => $order->billing_address_line1,
                    'line2' => $order->billing_address_line2,
                    'city' => $order->billing_city,
                    'state' => $order->billing_state,
                    'postcode' => $order->billing_postcode,
                    'country' => $order->billing_country,
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

    public function invoice(Request $request, Order $order)
    {
        $customer = $request->user('customer');

        if ($order->customer_id !== $customer->id) {
            return $this->respondError(__('Order not found.'), 404);
        }

        if ($order->status !== 'completed') {
            return $this->respondError(__('Invoice is available after the order is completed.'), 403);
        }

        $pdf = $this->invoiceService->buildPdf($order);

        return $pdf->stream("invoice-{$order->order_number}.pdf");
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

    public function complete(Request $request, Order $order)
    {
        $customer = $request->user('customer');

        if ($order->customer_id !== $customer->id) {
            return $this->respondError(__('Order not found.'), 404);
        }

        if ($order->status === 'completed') {
            return $this->respond([
                'order' => $order,
            ], __('Order already completed.'));
        }

        $isEligible = ($order->status === 'ready_for_pickup' && $order->payment_status === 'paid')
            || $order->status === 'shipped';

        if (! $isEligible) {
            return $this->respondError(__('Order cannot be completed in current status.'), 422);
        }

        DB::transaction(function () use ($order) {
            $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();

            if (! $lockedOrder || $lockedOrder->status === 'completed') {
                return;
            }

            $isEligible = ($lockedOrder->status === 'ready_for_pickup' && $lockedOrder->payment_status === 'paid')
                || $lockedOrder->status === 'shipped';

            if (! $isEligible) {
                return;
            }

            $lockedOrder->status = 'completed';
            $lockedOrder->completed_at = Carbon::now();
            $lockedOrder->save();
        });

        $order->refresh();

        return $this->respond([
            'order' => $order,
        ], __('Order marked as completed.'));
    }

    public function pay(Request $request, Order $order)
    {
        $customer = $request->user('customer');

        if ($order->customer_id !== $customer->id) {
            return $this->respondError(__('Order not found.'), 404);
        }

        if ($order->status !== 'pending' || $order->payment_status !== 'unpaid') {
            return $this->respondError(__('Order cannot be paid.'), 422);
        }

        if ($this->orderReserveService->isExpired($order)) {
            return $this->respondError(__('Order reservation has expired.'), 422);
        }

        if (!str_starts_with((string) $order->payment_method, 'billplz_')) {
            return $this->respondError(__('Order is not eligible for Billplz payment.'), 422);
        }

        if (!empty($order->payment_url)) {
            return $this->respond([
                'redirect_url' => $order->payment_url,
            ]);
        }

        try {
            $billplzUrl = DB::transaction(function () use ($order) {
                $billResponse = $this->billplzService->createBill($order);
                $billplzId = data_get($billResponse, 'id');
                $billplzUrl = data_get($billResponse, 'url');

                if (!$billplzId || !$billplzUrl) {
                    throw new RuntimeException('Invalid Billplz response.');
                }

                $order->payment_reference = $billplzId;
                $order->payment_url = $billplzUrl;
                $order->payment_provider = $order->payment_provider ?: 'billplz';
                $order->payment_meta = [
                    'provider' => 'billplz',
                    'bill_id' => $billplzId,
                    'collection_id' => data_get($billResponse, 'collection_id'),
                    'state' => data_get($billResponse, 'state'),
                    'reference_1' => data_get($billResponse, 'reference_1'),
                ];
                $order->save();

                BillplzBill::updateOrCreate(
                    ['billplz_id' => $billplzId],
                    [
                        'order_id' => $order->id,
                        'collection_id' => data_get($billResponse, 'collection_id'),
                        'state' => data_get($billResponse, 'state'),
                        'paid' => false,
                        'amount' => data_get($billResponse, 'amount'),
                        'payload' => $billResponse,
                    ]
                );

                return $billplzUrl;
            });
        } catch (Throwable $exception) {
            Log::error('Failed to initiate Billplz payment', [
                'error' => $exception->getMessage(),
                'order_id' => $order->id,
            ]);

            $status = $exception instanceof RuntimeException ? 422 : 500;
            $message = $exception instanceof RuntimeException
                ? $exception->getMessage()
                : __('Unable to initiate payment, please try again later.');

            return $this->respondError($message, $status);
        }

        return $this->respond([
            'redirect_url' => $billplzUrl,
        ]);
    }
}
