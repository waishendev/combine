<?php

namespace App\Services\Reports;

use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SalesChannelReportService
{
    public const CHANNEL_ALL = 'all';
    public const CHANNEL_ONLINE = 'online';
    public const CHANNEL_OFFLINE = 'offline';

    public const BOOKING_TYPE_ALL = 'all';
    public const BOOKING_TYPE_DEPOSIT = 'deposit';
    public const BOOKING_TYPE_FINAL_SETTLEMENT = 'final_settlement';
    public const BOOKING_TYPE_ADDON = 'addon';
    public const BOOKING_TYPE_PACKAGE_PURCHASE = 'package_purchase';
    public const BOOKING_TYPE_PRODUCT = 'booking_product';

    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product', 'service_package'];

    /**
     * Mirror MyPosSummaryReportController::baseOrdersScopeQuery logic so that
     * online booking orders (status=pending + payment_status=paid) are included.
     */
    private function applyOrderScope(Builder $q, string $alias = 'o'): Builder
    {
        return $q
            ->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.status", 'completed')
                    ->orWhere("{$alias}.payment_status", 'paid');
            })
            ->whereNotIn("{$alias}.status", ['cancelled', 'draft', 'voided'])
            ->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.payment_status", '!=', 'refunded')
                    ->orWhereNull("{$alias}.payment_status");
            })
            ->whereNull("{$alias}.refunded_at");
    }


    public function orderDetails(int $orderId): array
    {
        $order = Order::query()
            ->with([
                'customer:id,name',
                'payments:id,order_id,payment_method,amount,reference_no',
                'uploads:id,order_id,type,file_path,note,status,created_at,updated_at',
                'items' => fn ($query) => $query->orderBy('id'),
                'items.product:id,name,cn_name',
                'items.productVariant:id,title,sku,cn_name',
                'items.booking:id,booking_code,service_id,guest_name,guest_phone,guest_email',
                'items.booking.service:id,name,cn_name',
                'items.bookingService:id,name,cn_name',
                'items.staff:id,name',
                'items.staffSplits.staff:id,name',
            ])
            ->where('id', $orderId)
            ->where(function ($query) {
                $query->where('status', 'completed')
                    ->orWhere('payment_status', 'paid');
            })
            ->whereNotIn('status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('payment_status', '!=', 'refunded')
                    ->orWhereNull('payment_status');
            })
            ->whereNull('refunded_at')
            ->firstOrFail();

        $payments = $order->payments
            ->map(fn ($payment) => [
                'method' => (string) $payment->payment_method,
                'amount' => (float) $payment->amount,
                'reference_no' => $payment->reference_no,
            ])
            ->values();

        $bookingNumbers = $order->items
            ->map(fn (OrderItem $item) => $item->booking?->booking_code ?: ($item->booking_id ? 'BOOKING-' . $item->booking_id : null))
            ->filter()
            ->unique()
            ->values();

        $paymentProofs = $this->paymentProofsForOrder($order);

        $lineTypes = $order->items
            ->pluck('line_type')
            ->map(fn ($type) => $this->displayLineType((string) $type))
            ->filter()
            ->unique()
            ->values();

        $overrideUserLabels = $order->items
            ->map(fn (OrderItem $item) => data_get($item->price_override_snapshot, 'price_overridden_by'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $overrideUsers = $overrideUserLabels->isEmpty()
            ? collect()
            : User::query()
                ->whereIn('id', $overrideUserLabels->all())
                ->get(['id', 'name', 'email'])
                ->mapWithKeys(fn (User $user) => [(int) $user->id => (string) ($user->email ?: $user->name ?: ('User #' . $user->id))]);

        return [
            'order' => [
                'id' => (int) $order->id,
                'order_no' => (string) $order->order_number,
                'order_datetime' => optional($order->created_at)?->toIso8601String(),
                'customer' => (string) ($order->customer?->name ?: $order->shipping_name ?: $order->billing_name ?: 'Walk-in Customer'),
                'payment_method' => (string) ($order->payment_method ?: 'unknown'),
                'payments' => $payments->all(),
                'type' => $lineTypes->isEmpty() ? 'Order' : $lineTypes->implode(', '),
                'booking_no' => $bookingNumbers->isEmpty() ? null : $bookingNumbers->implode(', '),
                'status' => (string) $order->status,
                'grand_total' => (float) $order->grand_total,
                'payment_proofs' => $paymentProofs,
            ],
            'lines' => $order->items->map(fn (OrderItem $item) => $this->formatOrderDetailLine($item, $overrideUsers->all()))->values()->all(),
        ];
    }


    private function paymentProofsForOrder(Order $order): array
    {
        $proofs = collect();

        $order->uploads
            ->where('type', 'payment_slip')
            ->each(function ($upload) use ($proofs, $order) {
                if (! $upload->file_url) {
                    return;
                }

                $proofs->push([
                    'id' => 'order-upload-' . $upload->id,
                    'file_url' => $upload->file_url,
                    'uploaded_at' => optional($upload->created_at)?->toIso8601String(),
                    'payment_method' => (string) ($order->payment_method ?? ''),
                    'note' => $upload->note,
                    'status' => $upload->status,
                ]);
            });

        $bookingIds = $order->items
            ->pluck('booking_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($bookingIds->isNotEmpty()) {
            BookingPayment::query()
                ->whereIn('booking_id', $bookingIds->all())
                ->orderBy('id')
                ->get(['id', 'booking_id', 'provider', 'status', 'raw_response', 'created_at', 'updated_at'])
                ->each(function (BookingPayment $payment) use ($proofs) {
                    $raw = $payment->raw_response ?? [];
                    $manualUrl = data_get($raw, 'manual_slip_url');
                    $proofPath = data_get($raw, 'proof_path');
                    $fileUrl = $manualUrl ?: ($proofPath ? Storage::disk('public')->url((string) $proofPath) : null);

                    if (! $fileUrl) {
                        return;
                    }

                    $proofs->push([
                        'id' => 'booking-payment-' . $payment->id,
                        'file_url' => (string) $fileUrl,
                        'uploaded_at' => optional($payment->updated_at ?? $payment->created_at)?->toIso8601String(),
                        'payment_method' => (string) data_get($raw, 'payment_method', $payment->provider),
                        'note' => data_get($raw, 'manual_slip_note'),
                        'status' => (string) ($payment->status ?? data_get($raw, 'payment_status', '')),
                    ]);
                });
        }

        return $proofs
            ->unique(fn (array $proof) => $proof['file_url'])
            ->values()
            ->all();
    }

    private function formatOrderDetailLine(OrderItem $item, array $overrideUsers = []): array
    {
        $gross = (float) ($item->line_total_snapshot ?? (((float) $item->line_total) + (float) ($item->discount_amount ?? 0)));
        $discount = (float) ($item->discount_amount ?? 0);
        $net = (float) ($item->line_total_after_discount ?? $item->effective_line_total ?? max(0.0, $gross - $discount));
        $unitPrice = (float) ($item->unit_price_snapshot ?? $item->price_snapshot ?? 0);
        $variantName = trim((string) ($item->variant_name_snapshot ?: $item->productVariant?->title ?: ''));
        $lineType = (string) ($item->line_type ?? 'product');
        $productCnName = match ($lineType) {
            'product' => ($cn = trim((string) ($item->product?->cn_name ?? ''))) !== '' ? $cn : null,
            default => $item->displayCnName(),
        };
        $bookingNo = $item->booking?->booking_code ?: ($item->booking_id ? 'BOOKING-' . $item->booking_id : null);

        $staffSplits = $item->staffSplits
            ->map(fn ($split) => [
                'staff_id' => (int) $split->staff_id,
                'staff_name' => (string) ($split->staff?->name ?? ('Staff #' . $split->staff_id)),
                'share_percent' => (int) $split->share_percent,
                'commission_rate_snapshot' => (float) ($split->commission_rate_snapshot ?? 0),
            ])
            ->values();

        return [
            'id' => (int) $item->id,
            'line_type' => (string) ($item->line_type ?? 'product'),
            'type_label' => $this->displayLineType((string) ($item->line_type ?? 'product')),
            'booking_no' => $bookingNo,
            'name' => (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: $item->product?->name ?: $item->bookingService?->name ?: 'Line item'),
            'cn_name' => $productCnName,
            'variant_name' => $variantName !== '' ? $variantName : null,
            'variant_cn_name' => $item->displayVariantCnName(),
            'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot ?: $item->productVariant?->sku,
            'qty' => (int) ($item->quantity ?? 1),
            'unit_price' => $unitPrice,
            'gross_amount' => $gross,
            'discount_amount' => $discount,
            'net_amount' => $net,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) ($item->discount_value ?? 0),
            'discount_remark' => $item->discount_remark,
            'price_override' => $this->normalizeOrderItemPriceOverride($item, $overrideUsers),
            'staff_name' => $item->staff?->name,
            'staff_splits' => $staffSplits->all(),
        ];
    }


    private function normalizeOrderItemPriceOverride(OrderItem $item, array $overrideUsers = []): ?array
    {
        $snapshot = $item->price_override_snapshot;
        if (is_string($snapshot) && $snapshot !== '') {
            $decoded = json_decode($snapshot, true);
            $snapshot = is_array($decoded) ? $decoded : null;
        }
        if (! is_array($snapshot)) {
            return null;
        }

        $qty = max(1, (int) ($item->quantity ?? 1));
        $original = (float) ($snapshot['original_unit_price'] ?? $snapshot['original_unit_price_snapshot'] ?? 0);
        $adjusted = (float) ($snapshot['adjusted_unit_price'] ?? $snapshot['final_unit_price'] ?? $snapshot['unit_price_snapshot'] ?? 0);
        $originalLine = (float) ($snapshot['original_line_total'] ?? ($original * $qty));
        $adjustedLine = (float) ($snapshot['adjusted_line_total'] ?? $snapshot['final_line_total'] ?? ($adjusted * $qty));

        if ($original <= 0.0001 && $adjusted <= 0.0001 && empty($snapshot['price_override_reason'])) {
            return null;
        }

        $overriddenBy = isset($snapshot['price_overridden_by']) ? (int) $snapshot['price_overridden_by'] : null;

        return [
            'original_unit_price' => round(max(0.0, $original), 2),
            'original_unit_price_snapshot' => round(max(0.0, $original), 2),
            'adjusted_unit_price' => round(max(0.0, $adjusted), 2),
            'final_unit_price' => round(max(0.0, $adjusted), 2),
            'unit_price_snapshot' => round(max(0.0, $adjusted), 2),
            'original_line_total' => round(max(0.0, $originalLine), 2),
            'adjusted_line_total' => round(max(0.0, $adjustedLine), 2),
            'final_line_total' => round(max(0.0, $adjustedLine), 2),
            'price_override_amount' => round(max(0.0, $adjusted) - max(0.0, $original), 2),
            'price_override_reason' => $snapshot['price_override_reason'] ?? null,
            'price_override_mode' => $snapshot['price_override_mode'] ?? null,
            'price_overridden_by' => $overriddenBy,
            'price_overridden_by_label' => $overriddenBy ? ($overrideUsers[$overriddenBy] ?? ('User #' . $overriddenBy)) : null,
            'price_overridden_at' => $snapshot['price_overridden_at'] ?? null,
        ];
    }

    private function displayLineType(string $lineType): string
    {
        return match ($lineType) {
            'booking_deposit' => 'Booking Deposit',
            'booking_settlement' => 'Settlement Service',
            'booking_addon' => 'Add-on',
            'service_package' => 'Service Package',
            'booking_product' => 'Booking Product',
            default => 'Product',
        };
    }

    public function ecommerce(Carbon $start, Carbon $end, array $filters = []): array
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        $baseQuery = $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status, $customerId);

        $paginator = (clone $baseQuery)
            ->orderByDesc('order_datetime')
            ->paginate($perPage, ['*'], 'page', $page);

        $paymentRowsByOrder = $this->paymentRowsByOrderIds(collect($paginator->items())->pluck('order_id')->all());

        $rows = collect($paginator->items())->map(function ($row) use ($paymentRowsByOrder) {
            return [
                'order_id' => (int) $row->order_id,
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                'payments' => $paymentRowsByOrder->get((int) $row->order_id, []),
                'order_total' => (float) $row->order_total,
                'item_count' => (int) $row->item_count,
                'product_amount' => (float) $row->product_amount,
                'discount' => (float) $row->discount,
                'net_amount' => (float) $row->net_amount,
                'status' => (string) $row->status,
            ];
        })->values();

        $summaryRow = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_orders')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_sales')
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'online' THEN net_amount ELSE 0 END), 0) as online_sales")
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'offline' THEN net_amount ELSE 0 END), 0) as offline_sales")
            ->first();

        $totalsPage = $this->aggregateEcommerceTotals($rows);
        $grandTotals = [
            'orders_count' => (int) ($summaryRow->total_orders ?? 0),
            'product_amount' => (float) ((clone $baseQuery)->sum('product_amount') ?? 0),
            'discount' => (float) ((clone $baseQuery)->sum('discount') ?? 0),
            'net_amount' => (float) ($summaryRow->total_sales ?? 0),
        ];

        return [
            'summary' => [
                'total_sales' => (float) ($summaryRow->total_sales ?? 0),
                'online_sales' => (float) ($summaryRow->online_sales ?? 0),
                'offline_sales' => (float) ($summaryRow->offline_sales ?? 0),
                'total_orders' => (int) ($summaryRow->total_orders ?? 0),
            ],
            'totals_page' => $totalsPage,
            'grand_totals' => $grandTotals,
            'rows' => $rows,
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function ecommerceRows(Carbon $start, Carbon $end, array $filters = [])
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        return $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status, $customerId)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
                    'order_id' => (int) $row->order_id,
                    'order_no' => (string) $row->order_no,
                    'date_time' => (string) $row->order_datetime,
                    'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                    'channel' => (string) $row->channel,
                    'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                    'item_count' => (int) $row->item_count,
                    'product_amount' => (float) $row->product_amount,
                    'discount' => (float) $row->discount,
                    'net_amount' => (float) $row->net_amount,
                    'status' => (string) $row->status,
                ];
            });
    }

    public function booking(Carbon $start, Carbon $end, array $filters = []): array
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $type = $this->normalizeBookingType((string) ($filters['type'] ?? self::BOOKING_TYPE_ALL));
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        $baseQuery = $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type, $customerId);

        $paginator = (clone $baseQuery)
            ->orderByDesc('order_datetime')
            ->paginate($perPage, ['*'], 'page', $page);

        $cnNames = $this->resolveOrderItemCnNames(collect($paginator->items())->pluck('order_item_id')->all());
        $paymentRowsByOrder = $this->paymentRowsByOrderIds(collect($paginator->items())->pluck('order_id')->all());

        $rows = collect($paginator->items())->map(function ($row) use ($cnNames, $paymentRowsByOrder) {
            return [
                'order_id' => (int) $row->order_id,
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                'payments' => $paymentRowsByOrder->get((int) $row->order_id, []),
                'order_total' => (float) $row->order_total,
                'type' => (string) $row->type,
                'booking_id' => $row->booking_id ? (int) $row->booking_id : null,
                'booking_no' => $row->booking_no,
                'package_name' => $row->package_name,
                'package_cn_name' => $cnNames->get((int) $row->order_item_id),
                'gross_amount' => (float) $row->gross_amount,
                'discount' => (float) $row->discount,
                'net_amount' => (float) $row->net_amount,
                'status' => (string) $row->status,
            ];
        })->values();

        $summaryRow = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_transactions')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_booking_revenue')
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'online' THEN net_amount ELSE 0 END), 0) as online_booking_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'offline' THEN net_amount ELSE 0 END), 0) as offline_booking_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'deposit' THEN net_amount ELSE 0 END), 0) as booking_deposit_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'final_settlement' THEN net_amount ELSE 0 END), 0) as booking_settlement_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'addon' THEN net_amount ELSE 0 END), 0) as addon_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'package_purchase' THEN net_amount ELSE 0 END), 0) as package_purchase_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'booking_product' THEN net_amount ELSE 0 END), 0) as booking_product_amount")
            ->first();

        $totalsPage = $this->aggregateBookingTotals($rows);
        $grandTotals = [
            'orders_count' => (int) ($summaryRow->total_transactions ?? 0),
            'gross_amount' => (float) ((clone $baseQuery)->sum('gross_amount') ?? 0),
            'discount' => (float) ((clone $baseQuery)->sum('discount') ?? 0),
            'net_amount' => (float) ($summaryRow->total_booking_revenue ?? 0),
            'booking_deposit_amount' => (float) ($summaryRow->booking_deposit_amount ?? 0),
            'booking_settlement_amount' => (float) ($summaryRow->booking_settlement_amount ?? 0),
            'addon_revenue' => (float) ($summaryRow->addon_revenue ?? 0),
            'package_purchase_amount' => (float) ($summaryRow->package_purchase_amount ?? 0),
            'booking_product_amount' => (float) ($summaryRow->booking_product_amount ?? 0),
        ];

        return [
            'summary' => [
                'total_booking_revenue' => (float) ($summaryRow->total_booking_revenue ?? 0),
                'online_booking_revenue' => (float) ($summaryRow->online_booking_revenue ?? 0),
                'offline_booking_revenue' => (float) ($summaryRow->offline_booking_revenue ?? 0),
                'total_transactions' => (int) ($summaryRow->total_transactions ?? 0),
                'booking_deposit_amount' => (float) ($summaryRow->booking_deposit_amount ?? 0),
                'booking_settlement_amount' => (float) ($summaryRow->booking_settlement_amount ?? 0),
                'addon_revenue' => (float) ($summaryRow->addon_revenue ?? 0),
                'package_purchase_amount' => (float) ($summaryRow->package_purchase_amount ?? 0),
                'booking_product_amount' => (float) ($summaryRow->booking_product_amount ?? 0),
            ],
            'totals_page' => $totalsPage,
            'grand_totals' => $grandTotals,
            'rows' => $rows,
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function bookingRows(Carbon $start, Carbon $end, array $filters = [])
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $type = $this->normalizeBookingType((string) ($filters['type'] ?? self::BOOKING_TYPE_ALL));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        return $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type, $customerId)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
                    'order_id' => (int) $row->order_id,
                    'order_no' => (string) $row->order_no,
                    'date_time' => (string) $row->order_datetime,
                    'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                    'channel' => (string) $row->channel,
                    'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                    'type' => (string) $row->type,
                    'booking_id' => $row->booking_id ? (int) $row->booking_id : null,
                    'booking_no' => $row->booking_no,
                    'package_name' => $row->package_name,
                    'package_cn_name' => null,
                    'gross_amount' => (float) $row->gross_amount,
                    'discount' => (float) $row->discount,
                    'net_amount' => (float) $row->net_amount,
                    'status' => (string) $row->status,
                ];
            });
    }

    private function baseEcommerceRowsQuery(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        ?string $status,
        ?int $customerId = null
    ) {
        $query = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->whereBetween('o.created_at', [$start, $end])
        )
            ->where('oi.line_type', 'product')
            ->groupBy('o.id', 'o.order_number', 'order_datetime', 'c.name', 'channel', 'o.payment_method', 'o.status', 'o.grand_total')
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw('o.created_at as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
            ->selectRaw('o.grand_total as order_total')
            ->selectRaw('o.status')
            ->selectRaw('COALESCE(SUM(oi.quantity), 0) as item_count')
            ->selectRaw('COALESCE(SUM(oi.line_total), 0) as product_amount')
            ->selectRaw('COALESCE(SUM(oi.discount_amount), 0) as discount')
            ->selectRaw('COALESCE(SUM(COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))), 0) as net_amount');

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }
        if ($paymentMethod !== null) {
            $query->whereIn('o.payment_method', SalesReportService::paymentMethodVariantsForMatch($paymentMethod));
        }
        if ($status !== null) {
            $query->where('o.status', $status);
        }
        if ($customerId !== null) {
            $query->where('o.customer_id', $customerId);
        }

        return DB::query()->fromSub($query, 'rows');
    }

    private function baseBookingRowsQuery(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        string $type,
        ?int $customerId = null
    ) {
        $query = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
                ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
                ->whereBetween('o.created_at', [$start, $end])
        )
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw('o.created_at as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
            ->selectRaw('o.grand_total as order_total')
            ->selectRaw('o.status')
            ->selectRaw('oi.id AS order_item_id')
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' WHEN 'booking_product' THEN 'booking_product' ELSE 'package_purchase' END as type")
            ->selectRaw('oi.booking_id as booking_id')
            ->selectRaw('COALESCE(b.booking_code, CASE WHEN oi.booking_id IS NOT NULL THEN CONCAT(\'BOOKING-\', oi.booking_id) ELSE NULL END) as booking_no')
            ->selectRaw('COALESCE(oi.display_name_snapshot, oi.product_name_snapshot, sp.name) as package_name')
            ->selectRaw('COALESCE(oi.line_total_snapshot, oi.line_total + COALESCE(oi.discount_amount, 0), oi.line_total, 0) as gross_amount')
            ->selectRaw('COALESCE(oi.discount_amount, 0) as discount')
            ->selectRaw('COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0), 0) as net_amount');

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }
        if ($paymentMethod !== null) {
            $query->whereIn('o.payment_method', SalesReportService::paymentMethodVariantsForMatch($paymentMethod));
        }
        if ($type !== self::BOOKING_TYPE_ALL) {
            $lineType = match ($type) {
                self::BOOKING_TYPE_DEPOSIT => 'booking_deposit',
                self::BOOKING_TYPE_FINAL_SETTLEMENT => 'booking_settlement',
                self::BOOKING_TYPE_ADDON => 'booking_addon',
                self::BOOKING_TYPE_PACKAGE_PURCHASE => 'service_package',
                self::BOOKING_TYPE_PRODUCT => 'booking_product',
                default => null,
            };
            if ($lineType !== null) {
                $query->where('oi.line_type', $lineType);
            }
        }
        if ($customerId !== null) {
            $query->where('o.customer_id', $customerId);
        }

        return DB::query()->fromSub($query, 'rows');
    }


    private function paymentRowsByOrderIds(array $orderIds)
    {
        $ids = collect($orderIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return collect();
        }

        return DB::table('order_payments')
            ->whereIn('order_id', $ids)
            ->orderBy('id')
            ->get(['order_id', 'payment_method', 'amount', 'reference_no'])
            ->groupBy(fn ($row) => (int) $row->order_id)
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                'method' => (string) $row->payment_method,
                'amount' => (float) $row->amount,
                'reference_no' => $row->reference_no,
            ])->values()->all());
    }

    private function resolveOrderItemCnNames(array $ids)
    {
        $itemIds = collect($ids)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($itemIds === []) {
            return collect();
        }

        return OrderItem::query()
            ->with(['bookingService:id,cn_name', 'booking:id,addon_items_json'])
            ->whereIn('id', $itemIds)
            ->get()
            ->mapWithKeys(fn (OrderItem $item) => [(int) $item->id => $item->displayCnName()]);
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null) return null;
        if (is_int($value)) return $value > 0 ? $value : null;
        if (is_numeric($value)) {
            $i = (int) $value;
            return $i > 0 ? $i : null;
        }
        $s = is_string($value) ? trim($value) : '';
        if ($s === '' || strtolower($s) === 'all') return null;
        $i = (int) $s;
        return $i > 0 ? $i : null;
    }

    private function normalizeChannel(string $channel): string
    {
        return match (strtolower(trim($channel))) {
            self::CHANNEL_ONLINE => self::CHANNEL_ONLINE,
            self::CHANNEL_OFFLINE => self::CHANNEL_OFFLINE,
            default => self::CHANNEL_ALL,
        };
    }

    private function normalizeBookingType(string $type): string
    {
        return match (strtolower(trim($type))) {
            self::BOOKING_TYPE_DEPOSIT => self::BOOKING_TYPE_DEPOSIT,
            self::BOOKING_TYPE_FINAL_SETTLEMENT => self::BOOKING_TYPE_FINAL_SETTLEMENT,
            self::BOOKING_TYPE_ADDON => self::BOOKING_TYPE_ADDON,
            self::BOOKING_TYPE_PACKAGE_PURCHASE => self::BOOKING_TYPE_PACKAGE_PURCHASE,
            self::BOOKING_TYPE_PRODUCT => self::BOOKING_TYPE_PRODUCT,
            default => self::BOOKING_TYPE_ALL,
        };
    }

    private function nullableString(mixed $value): ?string
    {
        $string = is_string($value) ? trim($value) : '';

        return $string === '' ? null : $string;
    }

    private function aggregateEcommerceTotals($rows): array
    {
        return [
            'orders_count' => (int) $rows->count(),
            'product_amount' => (float) $rows->sum('product_amount'),
            'discount' => (float) $rows->sum('discount'),
            'net_amount' => (float) $rows->sum('net_amount'),
        ];
    }

    private function aggregateBookingTotals($rows): array
    {
        return [
            'orders_count' => (int) $rows->count(),
            'gross_amount' => (float) $rows->sum('gross_amount'),
            'discount' => (float) $rows->sum('discount'),
            'net_amount' => (float) $rows->sum('net_amount'),
            'booking_deposit_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_DEPOSIT)->sum('net_amount'),
            'booking_settlement_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_FINAL_SETTLEMENT)->sum('net_amount'),
            'addon_revenue' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_ADDON)->sum('net_amount'),
            'package_purchase_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_PACKAGE_PURCHASE)->sum('net_amount'),
            'booking_product_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_PRODUCT)->sum('net_amount'),
        ];
    }
}
