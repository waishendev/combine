<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderUpload;
use App\Services\Ecommerce\OrderPaymentService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function __construct(protected OrderPaymentService $paymentService)
    {
    }

    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
    
        $status = $request->filled('status') ? $request->string('status')->toString() : null;
        $paymentStatus = $request->filled('payment_status') ? $request->string('payment_status')->toString() : null;
    
        $orders = Order::with(['customer:id,name,email'])
            ->when($status, fn($q) => $q->where('status', $status))
            ->when($paymentStatus, fn($q) => $q->where('payment_status', $paymentStatus))
    
            // ✅ 只要 status=cancelled，就排除 refunded（除非你明确指定 payment_status=refunded）
            ->when($status === 'cancelled' && $paymentStatus !== 'refunded', function ($q) {
                $q->where(function ($query) {
                    $query->where('payment_status', '!=', 'refunded')
                          ->orWhereNull('payment_status');
                });
            })
    
            ->when($request->filled('customer_id'), fn($q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('order_no'), fn($q) => $q->where('order_number', 'like', '%' . $request->string('order_no')->toString() . '%'))
            ->when($request->filled('reference'), fn($q) => $q->where('order_number', 'like', '%' . $request->string('reference')->toString() . '%'))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('created_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn($q) => $q->whereDate('created_at', '<=', $request->date('date_to')))
            ->when($request->filled('store_location_id'), fn($q) => $q->where('pickup_store_id', $request->integer('store_location_id')))
            ->when($request->filled('pickup_ready_at_from'), fn($q) => $q->whereDate('pickup_ready_at', '>=', $request->date('pickup_ready_at_from')))
            ->when($request->filled('pickup_ready_at_to'), fn($q) => $q->whereDate('pickup_ready_at', '<=', $request->date('pickup_ready_at_to')))
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
        $order->load(['items.product.images', 'customer', 'vouchers', 'vouchers.voucher']);

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
            'pickup_ready_at' => $order->pickup_ready_at,
            'notes' => $order->notes,
            'admin_note' => $order->admin_note,
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
                $images = $item->product?->images
                    ? $item->product->images
                        ->sortBy('id')
                        ->sortBy('sort_order')
                    : collect();

                $thumbnail = optional(
                    $images->firstWhere('is_main', true) ?? $images->first()
                )->image_path;

                return [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name_snapshot ?? $item->product_name ?? $item->product?->name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->price_snapshot ?? $item->unit_price,
                    'line_total' => $item->line_total,
                    'product_image' => $thumbnail,
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
                'payment_proof_rejected_at' => $order->payment_proof_rejected_at,
                'refund_proof_path' => $order->refund_proof_path,
                'refunded_at' => $order->refunded_at,
                'payment_proof_path' => OrderUpload::where('order_id', $order->id)
                    ->get()
                    ->map(fn($upload) => [
                        'id' => $upload->id,
                        'type' => $upload->type,
                        'payment_proof_path' => $upload->file_url,
                        'created_at' => $upload->created_at,
                    ]),
            ],
        ]);
    }

    public function update(Request $request, Order $order)
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

        if ($validated['status'] === 'ready_for_pickup' && $order->pickup_ready_at === null) {
            $order->pickup_ready_at = Carbon::now();
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
            'admin_note' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($order, $validated) {
            $order->payment_status = 'paid';
            $order->status = 'confirmed';
            $order->paid_at = !empty($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : Carbon::now();
            if (!empty($validated['admin_note'])) {
                $order->admin_note = trim(($order->admin_note ?? '') . "\n" . $validated['admin_note']);
            }
            $order->save();

            $this->paymentService->handlePaid($order);
        });

        return $this->respond($order->fresh(['items', 'customer']), __('Payment confirmed.'));
    }

    public function RejectPaymentProof(Request $request, Order $order)
    {
        if ($order->payment_status === 'paid') {
            return $this->respond($order, __('Order already paid.'), false, 422);
        }

        $validated = $request->validate([
            'admin_note' => ['required', 'string'],
        ]);

        DB::transaction(function () use ($order, $validated) {
            $order->status = 'reject_payment_proof';
            $order->payment_proof_rejected_at =  Carbon::now();
            if (!empty($validated['admin_note'])) {
                $order->admin_note = trim(($order->admin_note ?? '') . "\n" . $validated['admin_note']);
            }
            $order->save();

        });

        return $this->respond($order->fresh(['items', 'customer']), __('Payment Proof Rejected.'));
    }


    public function cancelOrder(Request $request, Order $order)
    {
        if ($order->payment_status === 'paid') {
            return $this->respond($order, __('Order already paid.'), false, 422);
        }

        $validated = $request->validate([
            'admin_note' => ['required', 'string'],
        ]);

        DB::transaction(function () use ($order, $validated) {
            $order->status = 'cancelled';
            if (!empty($validated['admin_note'])) {
                $order->admin_note = trim(($order->admin_note ?? '') . "\n" . $validated['admin_note']);
            }
            $order->save();
        });

        return $this->respond($order->fresh(['items', 'customer']), __('Order cancelled.'));
    }

    public function refund(Request $request, Order $order)
    {
        // Debug: Log all request data
        Log::info('Refund request data:', [
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'all' => $request->all(),
            'input' => $request->input(),
            'files' => $request->allFiles(),
            'admin_note' => $request->input('admin_note'),
            'has_file' => $request->hasFile('refund_proof_path'),
            'raw_content' => $request->getContent(),
        ]);

        $validated = $request->validate([
            'admin_note' => ['required', 'string', 'min:1'],
            'refund_proof_path' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        DB::transaction(function () use ($order, $validated, $request) {
            $order->status = 'cancelled';
            $order->payment_status = 'refunded';
            
            if (!empty($validated['admin_note'])) {
                $order->admin_note = trim(($order->admin_note ?? '') . "\n" . $validated['admin_note']);
            }

            // Handle file upload if provided
            if ($request->hasFile('refund_proof_path')) {
                $filePath = $request->file('refund_proof_path')->store('refund-photos', 'public');
                $order->refund_proof_path = $filePath;
                $order->refunded_at = Carbon::now();
            }

            $order->save();
        });

        return $this->respond($order->fresh(['items', 'customer']), __('Order Refunded.'));
    }

}
