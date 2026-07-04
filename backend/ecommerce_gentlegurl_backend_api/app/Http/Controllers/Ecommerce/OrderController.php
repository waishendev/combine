<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Mail\BookingConfirmationMail;
use App\Mail\OrderShippedMail;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingItemPhoto;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingServicePhoto;
use App\Models\Ecommerce\Order;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\OrderUpload;
use App\Services\Ecommerce\OrderPaymentService;
use App\Services\Booking\BookingCancellationService;
// use App\Services\Ecommerce\OrderReserveService;
use App\Services\Ecommerce\InvoiceService;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function __construct(
        protected OrderPaymentService $paymentService,
        // protected OrderReserveService $orderReserveService,
        protected InvoiceService $invoiceService,
        protected BookingCancellationService $bookingCancellationService,
    )
    {
    }

    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $orderType = strtolower(trim((string) $request->query('order_type', '')));
        $includePaidBookingCompleted = $request->boolean('include_paid_booking_completed');
        $excludePaidBooking = $request->boolean('exclude_paid_booking');
    
        // Accept both array and single value for status
        $status = null;
        if ($request->has('status')) {
            $statusInput = $request->input('status');
            $status = is_array($statusInput) ? $statusInput : [$statusInput];
            $status = array_filter($status, fn($s) => !empty($s)); // Remove empty values
            $status = !empty($status) ? $status : null;
        }
        
        // Accept both array and single value for payment_status
        $paymentStatus = null;
        if ($request->has('payment_status')) {
            $paymentStatusInput = $request->input('payment_status');
            $paymentStatus = is_array($paymentStatusInput) ? $paymentStatusInput : [$paymentStatusInput];
            $paymentStatus = array_filter($paymentStatus, fn($ps) => !empty($ps)); // Remove empty values
            $paymentStatus = !empty($paymentStatus) ? $paymentStatus : null;
        }
    
        $orders = Order::with([
            'customer:id,name,email,phone',
            'items:id,order_id,line_type',
            'serviceItems:id,order_id',
            'returns:id,order_id,status,created_at',
            'returns.items:id,return_request_id,quantity',
        ])
            // Only include eCommerce shop orders here.
            // POS orders are created by an admin user and have created_by_user_id set.
            ->whereNull('created_by_user_id')
            ->when($orderType === 'booking', fn($q) => $this->applyBookingOrderScope($q))
            ->when($orderType === 'ecommerce', fn($q) => $this->applyNonBookingOrderScope($q))
            ->when($orderType === 'mixed', function ($q) {
                $this->applyBookingOrderScope($q);
                $q->whereHas('items', fn($itemQuery) => $itemQuery->where('line_type', 'product'));
            })
            ->when($status, function ($q) use ($status, $paymentStatus, $includePaidBookingCompleted, $orderType) {
                $applyStatusFilter = function ($statusQuery) use ($status, $paymentStatus) {
                    // If filtering ONLY by cancelled status (no other statuses) and payment_status is not specified
                    // (or doesn't include 'refunded'), exclude refunded orders to show only cancelled (non-refunded) orders.
                    $onlyCancelled = count($status) === 1 && $status[0] === 'cancelled';
                    if ($onlyCancelled && (!$paymentStatus || !in_array('refunded', $paymentStatus))) {
                        $statusQuery->where('status', 'cancelled')
                            ->where(function ($notRefundQuery) {
                                $notRefundQuery->where('payment_status', '!=', 'refunded')
                                    ->orWhereNull('payment_status');
                            });
                        return;
                    }

                    $statusQuery->whereIn('status', $status);
                };

                if (($includePaidBookingCompleted || $orderType === 'booking') && in_array('completed', $status, true)) {
                    $q->where(function ($completedQuery) use ($applyStatusFilter) {
                        $applyStatusFilter($completedQuery);
                        $completedQuery->orWhere(function ($paidBookingQuery) {
                            $this->applyBookingOrderScope($paidBookingQuery);
                            $paidBookingQuery->where('payment_status', 'paid');
                        });
                    });
                    return;
                }

                $applyStatusFilter($q);
            })
            ->when($paymentStatus, fn($q) => $q->whereIn('payment_status', $paymentStatus))
            ->when($excludePaidBooking, function ($q) {
                $q->where(function ($excludeQuery) {
                    $excludeQuery->where('payment_status', '!=', 'paid')
                        ->orWhereNull('payment_status')
                        ->orWhere(function ($nonBookingQuery) {
                            $this->applyNonBookingOrderScope($nonBookingQuery);
                        });
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
                $latestReturn = $order->returns
                    ->sortByDesc('created_at')
                    ->first();
                $returnItemsTotalQty = $order->returns
                    ->flatMap(fn($return) => $return->items)
                    ->sum('quantity');
                $returnSummary = [
                    'has_return' => $order->returns->isNotEmpty(),
                    'return_count' => $order->returns->count(),
                    'return_statuses' => $latestReturn ? [$latestReturn->status] : [],
                    'return_items_total_qty' => $returnItemsTotalQty,
                    'latest_return_id' => $latestReturn?->id,
                ];

                $customerName = $order->customer?->name
                    ?: $order->shipping_name
                    ?: $order->billing_name;
                $customerEmail = $order->customer?->email;

                return [
                    'id' => $order->id,
                    'order_no' => $order->order_number,
                    'customer' => $customerName || $customerEmail ? [
                        'id' => $order->customer?->id,
                        'name' => $customerName,
                        'email' => $customerEmail,
                    ] : null,
                    'order_type' => $this->detectOrderType($order),
                    'status' => $order->status,
                    'payment_status' => $order->payment_status,
                    'subtotal' => $order->subtotal,
                    'discount_total' => $order->discount_total,
                    'shipping_fee' => $order->shipping_fee,
                    'grand_total' => $order->grand_total,
                    'net_total' => (float) $order->grand_total - (float) ($order->refund_total ?? 0),
                    'shipping_method' => $order->pickup_or_shipping,
                    'created_at' => $order->created_at,
                    'refund_total' => $order->refund_total,
                    'return_summary' => $returnSummary,
                ];
            });
    
        return $this->respond($orders);
    }
    

    public function show(Order $order)
    {
        $order->load([
            'items.product.images',
            'items.productVariant',
            'items.booking:id,booking_code,customer_id,guest_name,guest_phone,guest_email,staff_id,service_id,start_at,end_at,status,payment_status,deposit_amount,addon_items_json,settled_service_amount',
            'items.booking.customer:id,name,phone,email',
            'items.booking.service:id,name,cn_name,duration_min,service_price,price',
            'items.booking.staff:id,name',
            'items.booking.itemPhotos:id,booking_id,file_path,original_name,mime_type,size,sort_order,created_at',
            'items.booking.servicePhotos:id,booking_id,image_path,caption,sort_order,created_at,updated_at',
            'items.booking.payments:id,booking_id,provider,amount,status,raw_response,created_at,updated_at',
            'items.bookingService:id,name,cn_name',
            'serviceItems.assignedStaff',
            'customer',
            'vouchers',
            'vouchers.voucher',
            'returns.items.orderItem',
        ]);

        $orderLineItems = $order->items->values();

        $claimsByBooking = CustomerServicePackageUsage::query()
            ->whereIn('booking_id', $order->serviceItems->pluck('booking_id')->filter()->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('booking_id');

        return $this->respond([
            'id' => $order->id,
            'order_type' => $this->detectOrderType($order),
            'order_no' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'subtotal' => $order->subtotal,
            'discount_total' => $order->discount_total,
            'shipping_fee' => $order->shipping_fee,
            'grand_total' => $order->grand_total,
            'net_total' => (float) $order->grand_total - (float) ($order->refund_total ?? 0),
            'shipping_method' => $order->pickup_or_shipping,
            'shipping_courier' => $order->shipping_courier,
            'shipping_tracking_no' => $order->shipping_tracking_no,
            'shipped_at' => $order->shipped_at,
            'pickup_ready_at' => $order->pickup_ready_at,
            'notes' => $order->notes,
            'admin_note' => $order->admin_note,
            'refund_total' => $order->refund_total,
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
            'customer' => $order->customer,
            'items' => $orderLineItems->where('line_type', 'product')->map(function ($item) {
                $thumbnail = $item->product?->cover_image_url;
                $productType = $item->product?->type;

                return [
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'product_type' => $productType,
                    'is_variant_product' => $productType === 'variant',
                    'product_name' => $item->product_name_snapshot ?? $item->product_name ?? $item->product?->name,
                    'product_cn_name' => ($productCn = trim((string) ($item->product?->cn_name ?? ''))) !== '' ? $productCn : null,
                    'variant_name' => $item->variant_name_snapshot,
                    'variant_cn_name' => $item->displayVariantCnName(),
                    'variant_sku' => $item->variant_sku_snapshot,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->price_snapshot ?? $item->unit_price,
                    'line_total' => $item->line_total,
                    'product_image' => $thumbnail,
                    'cover_image_url' => $thumbnail,
                ];
            }),
            'booking_deposit_items' => $orderLineItems->where('line_type', 'booking_deposit')->values()->map(function ($item) {
                return [
                    'item_type' => 'booking_deposit',
                    'display_name' => $item->display_name_snapshot ?: $item->product_name_snapshot,
                    'quantity' => (int) $item->quantity,
                    'unit_price' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot),
                    'line_total' => (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total),
                    'booking_id' => $item->booking_id,
                    'booking_service_id' => $item->booking_service_id,
                    'booking_service_name' => $item->bookingService?->name,
                    'booking_service_cn_name' => $item->bookingService?->cn_name,
                    'booking_details' => $this->mapBookingDetail($item->booking),
                ];
            }),
            'booking_addon_items' => $orderLineItems->where('line_type', 'booking_addon')
                ->reject(fn ($item) => $this->isFakeMainServiceBookingAddon($item))
                ->values()
                ->map(function ($item) {
                    return [
                        'item_type' => 'booking_addon',
                        'display_name' => $item->display_name_snapshot ?: $item->product_name_snapshot,
                        'quantity' => (int) $item->quantity,
                        'unit_price' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot),
                        'line_total' => (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total),
                        'booking_id' => $item->booking_id,
                        'booking_service_id' => $item->booking_service_id,
                        'booking_service_name' => $item->bookingService?->name,
                        'booking_service_cn_name' => $item->bookingService?->cn_name,
                        'booking_details' => $this->mapBookingDetail($item->booking),
                    ];
                }),
            'service_items' => $order->serviceItems->values()->map(function ($item) use ($claimsByBooking) {
                $claims = $item->booking_id ? ($claimsByBooking->get((int) $item->booking_id) ?? collect()) : collect();
                $claimStatus = null;
                if ($claims->contains(fn ($claim) => $claim->status === 'consumed')) {
                    $claimStatus = 'consumed';
                } elseif ($claims->contains(fn ($claim) => $claim->status === 'reserved')) {
                    $claimStatus = 'reserved';
                } elseif ($claims->contains(fn ($claim) => $claim->status === 'released')) {
                    $claimStatus = 'released';
                }

                return [
                    'item_type' => $item->item_type ?: 'service',
                    'service_name' => $item->service_name_snapshot,
                    'quantity' => $item->qty,
                    'unit_price' => $item->price_snapshot,
                    'line_total' => $item->line_total,
                    'assigned_staff_name' => $item->assignedStaff?->name,
                    'start_at' => $item->start_at,
                    'end_at' => $item->end_at,
                    'package_claim_status' => $claimStatus,
                    'package_claim_note' => $claimStatus === 'reserved'
                        ? 'Reserved from package, will be consumed upon service completion'
                        : ($claimStatus === 'consumed'
                            ? 'Consumed from package'
                            : ($claimStatus === 'released' ? 'Package reservation released' : null)),
                ];
            }),
            'package_items' => $orderLineItems->where('line_type', 'service_package')->groupBy('service_package_id')->map(function ($rows) {
                $first = $rows->first();
                $unitPrice = (float) ($first?->effective_unit_price ?? $first?->unit_price_snapshot ?? $first?->price_snapshot ?? 0);
                return [
                    'item_type' => 'service_package',
                    'service_package_id' => (int) ($first?->service_package_id ?? 0),
                    'customer_service_package_id' => (int) ($first?->customer_service_package_id ?? 0),
                    'package_name' => (string) ($first?->display_name_snapshot ?: $first?->product_name_snapshot ?: 'Service Package'),
                    'quantity' => (int) $rows->count(),
                    'unit_price' => $unitPrice,
                    'line_total' => (float) $rows->sum(fn ($row) => (float) ($row->effective_line_total ?? $row->line_total_snapshot ?? $row->line_total ?? 0)),
                ];
            })->values(),
            'returns' => $order->returns->map(function ($return) use ($order) {
                $refundStatus = $order->payment_status === 'refunded' ? 'refunded' : 'not_refunded';

                return [
                    'id' => $return->id,
                    'status' => $return->status,
                    'reason' => $return->reason,
                    'requested_at' => $return->created_at,
                    'reviewed_at' => $return->reviewed_at,
                    'received_at' => $return->received_at,
                    'completed_at' => $return->completed_at,
                    'items' => $return->items->map(function ($item) {
                        $orderItem = $item->orderItem;
                        $productName = $orderItem?->product_name_snapshot ?? $orderItem?->product_name ?? '';
                        $productType = $orderItem?->product?->type;

                        return [
                            'order_item_id' => $item->order_item_id,
                            'product_name' => $productName,
                            'product_cn_name' => ($productCn = trim((string) ($orderItem?->product?->cn_name ?? ''))) !== '' ? $productCn : null,
                            'product_variant_id' => $orderItem?->product_variant_id,
                            'product_type' => $productType,
                            'is_variant_product' => $productType === 'variant',
                            'variant_name' => $orderItem?->variant_name_snapshot,
                            'variant_cn_name' => $orderItem?->displayVariantCnName(),
                            'variant_sku' => $orderItem?->variant_sku_snapshot,
                            'qty' => $item->quantity,
                        ];
                    }),
                    'refund' => [
                        'status' => $refundStatus,
                        'refunded_at' => $refundStatus === 'refunded' ? $order->refunded_at : null,
                        'amount' => $return->refund_amount ?? '0.00',
                    ],
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


    protected function applyBookingOrderScope($query): void
    {
        $query->where(function ($bookingQuery) {
            $bookingQuery->whereHas('items', function ($itemQuery) {
                $itemQuery->whereIn('line_type', [
                    'booking_deposit',
                    'booking_addon',
                    'booking_settlement',
                    'booking_product',
                    'service_package',
                ]);
            })
                ->orWhereHas('serviceItems')
                ->orWhere('notes', 'like', '%Booking cart checkout%');
        });
    }

    protected function applyNonBookingOrderScope($query): void
    {
        $query->whereDoesntHave('items', function ($itemQuery) {
            $itemQuery->whereIn('line_type', [
                'booking_deposit',
                'booking_addon',
                'booking_settlement',
                'booking_product',
                'service_package',
            ]);
        })
            ->whereDoesntHave('serviceItems')
            ->where(function ($noteQuery) {
                $noteQuery->whereNull('notes')
                    ->orWhere('notes', 'not like', '%Booking cart checkout%');
            });
    }

    protected function mapBookingDetail(?Booking $booking): ?array
    {
        if (! $booking) {
            return null;
        }

        $addonItems = $this->mapBookingAddonItems($booking->addon_items_json);
        $addonTotal = collect($addonItems)->sum(fn (array $item) => (float) ($item['extra_price'] ?? 0));
        $serviceTotal = $booking->settled_service_amount !== null
            ? (float) $booking->settled_service_amount
            : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
        $totalAmount = round(max(0, $serviceTotal + $addonTotal), 2);

        $orderItems = $booking->relationLoaded('orderItems')
            ? $booking->orderItems
            : $booking->orderItems()
                ->whereIn('line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
                ->get(['id', 'booking_id', 'line_type', 'line_total']);
        $orderDepositPaid = (float) $orderItems
            ->where('line_type', 'booking_deposit')
            ->sum(fn ($item) => (float) ($item->line_total ?? 0));
        $settlementPaid = (float) $orderItems
            ->filter(fn ($item) => in_array((string) $item->line_type, ['booking_settlement', 'booking_addon'], true))
            ->sum(fn ($item) => (float) ($item->line_total ?? 0));
        $bookingPaymentPaid = $booking->relationLoaded('payments')
            ? (float) $booking->payments->where('status', 'PAID')->sum(fn (BookingPayment $payment) => (float) ($payment->amount ?? 0))
            : (float) $booking->payments()->where('status', 'PAID')->sum('amount');
        $depositPaid = max($orderDepositPaid, $bookingPaymentPaid, (float) ($booking->payment_status === 'PAID' ? $booking->deposit_amount : 0));

        $packageUsage = CustomerServicePackageUsage::query()
            ->where(function ($query) use ($booking) {
                $query->where('booking_id', (int) $booking->id)
                    ->orWhere(function ($posQuery) use ($booking) {
                        $posQuery->where('used_from', 'POS')
                            ->where('used_ref_id', (int) $booking->id);
                    });
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->first();
        $packageOffset = $packageUsage ? max(0.0, $serviceTotal) : 0.0;
        $balanceDue = round(max(0, $totalAmount - $depositPaid - $settlementPaid - $packageOffset), 2);

        $itemPhotos = $booking->relationLoaded('itemPhotos')
            ? $booking->itemPhotos
            : $booking->itemPhotos()->get();
        $servicePhotos = $booking->relationLoaded('servicePhotos')
            ? $booking->servicePhotos
            : $booking->servicePhotos()->get();

        return [
            'id' => (int) $booking->id,
            'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $booking->id)),
            'customer' => $booking->customer ? [
                'id' => (int) $booking->customer->id,
                'name' => (string) $booking->customer->name,
                'phone' => $booking->customer->phone,
                'email' => $booking->customer->email,
            ] : null,
            'guest_name' => $booking->guest_name,
            'guest_phone' => $booking->guest_phone,
            'guest_email' => $booking->guest_email,
            'settlement_notes' => ($settlementNotes = trim((string) ($booking->settlement_notes ?? ''))) !== '' ? $settlementNotes : null,
            'service' => $booking->service ? [
                'id' => (int) $booking->service->id,
                'name' => (string) $booking->service->name,
                'cn_name' => $booking->service->cn_name,
                'duration_min' => (int) ($booking->service->duration_min ?? 0),
            ] : null,
            'add_ons' => $addonItems,
            'staff' => $booking->staff ? [
                'id' => (int) $booking->staff->id,
                'name' => (string) $booking->staff->name,
            ] : null,
            'start_at' => optional($booking->start_at)?->toIso8601String(),
            'end_at' => optional($booking->end_at)?->toIso8601String(),
            'status' => (string) $booking->status,
            'payment_status' => (string) $booking->payment_status,
            'deposit_paid' => round($depositPaid, 2),
            'settlement_paid' => round($settlementPaid, 2),
            'balance_due' => $balanceDue,
            'package_offset' => round($packageOffset, 2),
            'uploaded_item_photos' => $itemPhotos->map(fn (BookingItemPhoto $photo) => [
                'id' => (int) $photo->id,
                'file_url' => $photo->file_url,
                'original_name' => (string) $photo->original_name,
            ])->values(),
            'service_photos' => $servicePhotos->map(fn (BookingServicePhoto $photo) => [
                'id' => (int) $photo->id,
                'file_url' => $photo->image_url,
                'caption' => $photo->caption,
            ])->values(),
        ];
    }

    protected function mapBookingAddonItems($rawItems): array
    {
        return collect(is_array($rawItems) ? $rawItems : [])
            ->map(function ($item) {
                if (! is_array($item)) {
                    return null;
                }

                $name = $item['name'] ?? $item['label'] ?? $item['service_name'] ?? null;
                if (! $name) {
                    return null;
                }

                return [
                    'name' => (string) $name,
                    'cn_name' => $item['cn_name'] ?? $item['cn_label'] ?? $item['linked_cn_name'] ?? null,
                    'extra_duration_min' => (int) ($item['extra_duration_min'] ?? $item['duration_min'] ?? 0),
                    'extra_price' => (float) ($item['extra_price'] ?? $item['price'] ?? 0),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    protected function detectOrderType(Order $order): string
    {
        $items = $order->relationLoaded('items') ? $order->items : $order->items()->get(['id', 'order_id', 'line_type']);
        $hasProductItems = $items->contains(fn ($item) => (string) ($item->line_type ?? 'product') === 'product');
        $hasBookingLineItems = $items->contains(fn ($item) => in_array((string) ($item->line_type ?? ''), [
            'booking_deposit',
            'booking_addon',
            'booking_settlement',
            'booking_product',
            'service_package',
        ], true));
        $hasServiceItems = $order->relationLoaded('serviceItems')
            ? $order->serviceItems->isNotEmpty()
            : $order->serviceItems()->exists();
        $hasBookingCheckoutNote = stripos((string) ($order->notes ?? ''), 'Booking cart checkout') !== false;
        $hasBookingItems = $hasBookingLineItems || $hasServiceItems || $hasBookingCheckoutNote;

        if ($hasBookingItems && $hasProductItems) {
            return 'mixed';
        }

        if ($hasBookingItems) {
            return 'booking';
        }

        return 'ecommerce';
    }

    public function invoice(Order $order)
    {
        if (! $this->invoiceService->canCustomerDownloadInvoice($order)) {
            return $this->respondError(__('Invoice is available after the order is completed.'), 403);
        }

        $pdf = $this->invoiceService->buildPdf($order);

        return $pdf->stream("invoice-{$order->order_number}.pdf");
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

        if ($validated['status'] === 'shipped') {
            $this->sendOrderShippedEmail($order->fresh(['items', 'customer']));
        }

        return $this->respond($order, __('Order status updated.'));
    }

    protected function sendOrderShippedEmail(Order $order): void
    {
        $recipientEmail = $order->customer?->email;

        if (! $recipientEmail || ! filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $customerName = $order->shipping_name
            ?: $order->customer?->name
            ?: 'Customer';

        $items = $order->items
            ->map(fn ($item) => [
                'name' => (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Item'),
                'qty' => (int) $item->quantity,
                'line_total' => (float) ($item->line_total_after_discount ?? $item->line_total ?? 0),
            ])
            ->all();

        $addressParts = array_filter([
            $order->shipping_address_line1,
            $order->shipping_address_line2,
            $order->shipping_city,
            $order->shipping_state,
            $order->shipping_postcode,
            $order->shipping_country,
        ]);

        $widget = SettingService::get('shop_contact_widget', null, 'booking');
        $phone = data_get($widget, 'whatsapp.phone');
        $contactPhone = ($phone && is_string($phone) && trim($phone) !== '')
            ? trim($phone)
            : '010-387 0881';

        try {
            Mail::to($recipientEmail)->queue(new OrderShippedMail(
                customerName: $customerName,
                orderNumber: (string) ($order->order_number ?? ''),
                shippingCourier: (string) ($order->shipping_courier ?? ''),
                trackingNo: (string) ($order->shipping_tracking_no ?? ''),
                shippedAt: $order->shipped_at ? $order->shipped_at->format('l, d M Y h:i A') : '',
                shippingName: (string) ($order->shipping_name ?? ''),
                shippingPhone: (string) ($order->shipping_phone ?? ''),
                shippingAddress: implode(', ', $addressParts),
                grandTotal: (float) $order->grand_total,
                items: $items,
                contactPhone: $contactPhone,
            ));

            Log::info('Order shipped email queued.', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'email' => $recipientEmail,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to queue order shipped email.', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }
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
            $order->status = $this->detectOrderType($order) === 'booking' ? 'completed' : 'confirmed';
            $order->paid_at = !empty($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : Carbon::now();
            if (!empty($validated['admin_note'])) {
                $order->admin_note = trim(($order->admin_note ?? '') . "\n" . $validated['admin_note']);
            }
            $order->save();

            $this->paymentService->handlePaid($order);
            $this->confirmOrderBookings($order);
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

        $isBookingOrder = $this->detectOrderType($order) === 'booking';

        if ($isBookingOrder && ! in_array((string) $order->status, ['pending', 'processing'], true)) {
            return $this->respond($order, __('Only awaiting payment or waiting verification booking orders can be cancelled here.'), false, 422);
        }

        try {
            DB::transaction(function () use ($request, $order, $validated, $isBookingOrder) {
                $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

                if ($lockedOrder->payment_status === 'paid') {
                    throw new \RuntimeException('Order already paid.');
                }

                if ($isBookingOrder && ! in_array((string) $lockedOrder->status, ['pending', 'processing'], true)) {
                    throw new \RuntimeException('Only awaiting payment or waiting verification booking orders can be cancelled here.');
                }

                $lockedOrder->status = 'cancelled';
                if (!empty($validated['admin_note'])) {
                    $lockedOrder->admin_note = trim(($lockedOrder->admin_note ?? '') . "\n" . $validated['admin_note']);
                }
                $lockedOrder->save();

                if ($isBookingOrder) {
                    $this->cancelLinkedOrderBookings($lockedOrder, $request, $validated['admin_note']);
                }

                // $this->orderReserveService->releaseStockForOrder($lockedOrder);
            });
        } catch (\RuntimeException $exception) {
            return $this->respond($order, __($exception->getMessage()), false, 422);
        }

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
            'refund_amount' => ['required', 'numeric', 'min:0.01'],
            'refund_proof_path' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        $refundAmount = (float) $validated['refund_amount'];

        try {
            DB::transaction(function () use ($order, $validated, $request, $refundAmount) {
                $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();
                if (! $lockedOrder) {
                    return;
                }

                $remaining = (float) $lockedOrder->grand_total - (float) $lockedOrder->refund_total;
                if ($refundAmount > $remaining) {
                    throw new \RuntimeException('Refund amount exceeds remaining refundable total.');
                }

                $lockedOrder->status = 'cancelled';
                $lockedOrder->payment_status = 'refunded';
                $lockedOrder->refund_total = (float) $lockedOrder->refund_total + $refundAmount;
                
                if (!empty($validated['admin_note'])) {
                    $lockedOrder->admin_note = trim(($lockedOrder->admin_note ?? '') . "\n" . $validated['admin_note']);
                }

                // Handle file upload if provided
                if ($request->hasFile('refund_proof_path')) {
                    $filePath = $request->file('refund_proof_path')->store('refund-photos', 'public');
                    $lockedOrder->refund_proof_path = $filePath;
                }

                $lockedOrder->refunded_at = Carbon::now();
                $lockedOrder->save();
            });
        } catch (\RuntimeException $exception) {
            return $this->respond(null, __($exception->getMessage()), false, 422);
        }

        return $this->respond($order->fresh(['items', 'customer']), __('Order Refunded.'));
    }

    public function complete(Order $order)
    {
        if ($order->status === 'completed') {
            return $this->respond($order, __('Order already completed.'));
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

        return $this->respond($order, __('Order marked as completed.'));
    }

    protected function linkedBookingIdsForOrder(Order $order)
    {
        $itemBookingIds = $order->items()
            ->whereNotNull('booking_id')
            ->pluck('booking_id');

        $serviceBookingIds = $order->serviceItems()
            ->whereNotNull('booking_id')
            ->pluck('booking_id');

        return $itemBookingIds
            ->merge($serviceBookingIds)
            ->unique()
            ->filter()
            ->values();
    }

    protected function cancelLinkedOrderBookings(Order $order, Request $request, string $reason): void
    {
        $bookingIds = $this->linkedBookingIdsForOrder($order);

        if ($bookingIds->isEmpty()) {
            return;
        }

        $bookings = Booking::query()
            ->whereIn('id', $bookingIds)
            ->lockForUpdate()
            ->get();

        foreach ($bookings as $booking) {
            if ((string) $booking->status === 'CANCELLED') {
                continue;
            }

            if ((string) $booking->payment_status === 'PAID') {
                throw new \RuntimeException('Linked paid booking cannot be cancelled from this flow.');
            }

            $this->bookingCancellationService->cancel(
                $booking,
                optional($request->user())->id,
                $reason,
                'ADMIN',
                ['HOLD', 'CONFIRMED', 'PENDING'],
                [
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'source' => 'booking_order_cancel',
                ]
            );
        }

        Log::info('Booking order cancelled with linked bookings', [
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'booking_ids' => $bookingIds->all(),
        ]);
    }


    protected function confirmOrderBookings(Order $order): void
    {
        $bookingIds = $order->items()
            ->whereNotNull('booking_id')
            ->pluck('booking_id')
            ->unique()
            ->filter()
            ->values();

        if ($bookingIds->isEmpty()) {
            return;
        }

        Booking::query()
            ->whereIn('id', $bookingIds)
            ->where('payment_status', '!=', 'PAID')
            ->update([
                'status' => 'CONFIRMED',
                'payment_status' => 'PAID',
                'hold_expires_at' => null,
                'updated_at' => now(),
            ]);

        foreach ($bookingIds as $bookingId) {
            BookingLog::create([
                'booking_id' => $bookingId,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => [
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'source' => 'admin_confirm',
                ],
                'created_at' => now(),
            ]);
        }

        $bookings = Booking::query()
            ->whereIn('id', $bookingIds)
            ->where('status', 'CONFIRMED')
            ->with(['service', 'staff', 'customer'])
            ->get();

        foreach ($bookings as $booking) {
            $this->sendBookingConfirmationEmail($booking);
        }

        Log::info('Order bookings confirmed via admin payment confirmation', [
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'booking_ids' => $bookingIds->all(),
        ]);
    }


    private function isFakeMainServiceBookingAddon($item): bool
    {
        if ((string) ($item->line_type ?? '') !== 'booking_addon') {
            return false;
        }

        $amount = (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total ?? 0);
        if ($amount > 0.0001) {
            return false;
        }

        $serviceName = trim((string) ($item->bookingService?->name ?? ''));
        $serviceCnName = trim((string) ($item->bookingService?->cn_name ?? ''));
        if ($serviceName === '' && $serviceCnName === '') {
            return false;
        }

        $displayName = trim((string) ($item->display_name_snapshot ?: $item->product_name_snapshot));
        return $displayName !== '' && in_array(mb_strtolower($displayName), array_filter([
            $serviceName !== '' ? mb_strtolower($serviceName) : null,
            $serviceCnName !== '' ? mb_strtolower($serviceCnName) : null,
        ]), true);
    }

    protected function sendBookingConfirmationEmail(?Booking $booking): void
    {
        if (!$booking || (string) $booking->status !== 'CONFIRMED') {
            return;
        }

        $recipientEmail = $booking->billing_email
            ?: $booking->guest_email
            ?: $booking->customer?->email;

        if (!$recipientEmail || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $customerName = $booking->billing_name
            ?: $booking->guest_name
            ?: $booking->customer?->name
            ?: 'Customer';

        try {
            $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
                ->map(fn ($item) => is_array($item) ? [
                    'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                    'extra_duration_min' => (int) ($item['extra_duration_min'] ?? 0),
                    'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                ] : null)
                ->filter()
                ->values()
                ->all();

            $widget = SettingService::get('shop_contact_widget', null, 'booking');
            $phone = data_get($widget, 'whatsapp.phone');
            $contactPhone = ($phone && is_string($phone) && trim($phone) !== '')
                ? trim($phone)
                : '010-387 0881';

            Mail::to($recipientEmail)->queue(new BookingConfirmationMail(
                bookingCode: (string) ($booking->booking_code ?? ''),
                customerName: $customerName,
                serviceName: (string) ($booking->service?->name ?? 'Service'),
                staffName: (string) ($booking->staff?->name ?? ''),
                appointmentDate: $booking->start_at?->format('l, d M Y') ?? '—',
                appointmentStartTime: $booking->start_at?->format('h:i A') ?? '—',
                appointmentEndTime: $booking->end_at?->format('h:i A') ?? '—',
                durationMin: (int) ($booking->service?->duration_min ?? 0),
                depositAmount: (float) ($booking->deposit_amount ?? 0),
                source: (string) ($booking->source ?? 'ONLINE'),
                addonItems: $addonItems,
                contactPhone: $contactPhone,
            ));
        } catch (\Throwable $e) {
            Log::error('Failed to queue booking confirmation email (admin confirm).', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
