<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderUpload;
use App\Services\Ecommerce\OrderPaymentService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function __construct(protected OrderPaymentService $paymentService)
    {
    }

    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $orders = Order::with(['customer:id,name,email'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('payment_status'), fn($q) => $q->where('payment_status', $request->string('payment_status')))
            ->when($request->filled('customer_id'), fn($q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('order_no'), fn($q) => $q->where('order_number', 'like', '%' . $request->string('order_no')->toString() . '%'))
            ->when($request->filled('reference'), fn($q) => $q->where('order_number', 'like', '%' . $request->string('reference')->toString() . '%'))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('created_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn($q) => $q->whereDate('created_at', '<=', $request->date('date_to')))
            ->when($request->filled('store_location_id'), fn($q) => $q->where('pickup_store_id', $request->integer('store_location_id')))
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->through(function (Order $order) {
                return [
                    'id' => $order->id,
                    'order_no' => $order->order_number,
                    'customer' => $order->customer ? [
                        'id' => $order->customer->id,
                        'name' => $order->customer->name,
                        'email' => $order->customer->email,
                    ] : null,
                    'status' => $order->status,
                    'payment_status' => $order->payment_status,
                    'subtotal' => $order->subtotal,
                    'discount_total' => $order->discount_total,
                    'shipping_fee' => $order->shipping_fee,
                    'grand_total' => $order->grand_total,
                    'shipping_method' => $order->pickup_or_shipping,
                    'created_at' => $order->created_at,
                ];
            });

        return $this->respond($orders);
    }

    public function show(Order $order)
    {
        $order->load(['items', 'customer', 'vouchers', 'vouchers.voucher']);

        return $this->respond([
            'id' => $order->id,
            'order_no' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'subtotal' => $order->subtotal,
            'discount_total' => $order->discount_total,
            'shipping_fee' => $order->shipping_fee,
            'grand_total' => $order->grand_total,
            'shipping_method' => $order->pickup_or_shipping,
            'shipping_courier' => $order->shipping_courier,
            'shipping_tracking_no' => $order->shipping_tracking_no,
            'shipped_at' => $order->shipped_at,
            'notes' => $order->notes,
            'address' => [
                'shipping_name' => $order->shipping_name,
                'shipping_phone' => $order->shipping_phone,
                'shipping_address_line1' => $order->shipping_address_line1,
                'shipping_address_line2' => $order->shipping_address_line2,
                'shipping_city' => $order->shipping_city,
                'shipping_state' => $order->shipping_state,
                'shipping_postcode' => $order->shipping_postcode,
                'shipping_country' => $order->shipping_country,
            ],
            'customer' => $order->customer,
            'items' => $order->items->map(function ($item) {
                return [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name ?? $item->product?->name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ];
            }),
            'vouchers' => $order->vouchers->map(function ($voucher) {
                return [
                    'code' => $voucher->code_snapshot,
                    'discount_amount' => $voucher->discount_amount,
                ];
            }),
            'payment_info' => [
                'payment_status' => $order->payment_status,
                'paid_at' => $order->paid_at,
                'payment_method' => $order->payment_method,
            ],
            'uploads' => OrderUpload::where('order_id', $order->id)
                ->get()
                ->map(fn($upload) => [
                    'id' => $upload->id,
                    'type' => $upload->type,
                    'file_url' => $upload->file_url,
                    'created_at' => $upload->created_at,
                ]),
        ]);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', 'string'],
            'shipping_courier' => ['nullable', 'string', 'max:100'],
            'shipping_tracking_no' => ['nullable', 'string', 'max:100'],
            'shipped_at' => ['nullable', 'date'],
        ]);

        $order->status = $validated['status'];
        $order->shipping_courier = $validated['shipping_courier'] ?? $order->shipping_courier;
        $order->shipping_tracking_no = $validated['shipping_tracking_no'] ?? $order->shipping_tracking_no;
        $order->shipped_at = !empty($validated['shipped_at']) ? Carbon::parse($validated['shipped_at']) : $order->shipped_at;

        if ($order->status === 'completed' && ! $order->completed_at) {
            $order->completed_at = Carbon::now();
        }

        $order->save();

        return $this->respond($order, __('Order status updated.'));
    }

    public function confirmPayment(Request $request, Order $order)
    {
        if ($order->payment_status === 'paid') {
            return $this->respond($order, __('Order already paid.'), false, 422);
        }

        $validated = $request->validate([
            'paid_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($order, $validated) {
            $order->payment_status = 'paid';
            $order->paid_at = !empty($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : Carbon::now();
            if (!empty($validated['note'])) {
                $order->notes = trim($order->notes . "\n" . $validated['note']);
            }
            $order->save();

            $this->paymentService->handlePaid($order);
        });

        return $this->respond($order->fresh(['items', 'customer']), __('Payment confirmed.'));
    }
}
