<?php

namespace App\Services\Reports;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SalesChannelReportService
{
    public const CHANNEL_ALL = 'all';
    public const CHANNEL_ONLINE = 'online';
    public const CHANNEL_OFFLINE = 'offline';

    public const BOOKING_TYPE_ALL = 'all';
    public const BOOKING_TYPE_DEPOSIT = 'deposit';
    public const BOOKING_TYPE_FINAL_SETTLEMENT = 'final_settlement';
    public const BOOKING_TYPE_PACKAGE_PURCHASE = 'package_purchase';

    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'service_package'];

    public function ecommerce(Carbon $start, Carbon $end, array $filters = []): array
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);

        $baseQuery = $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status);

        $paginator = (clone $baseQuery)
            ->orderByDesc('order_datetime')
            ->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(function ($row) {
            return [
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
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

        return $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
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

        $baseQuery = $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type);

        $paginator = (clone $baseQuery)
            ->orderByDesc('order_datetime')
            ->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(function ($row) {
            return [
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                'type' => (string) $row->type,
                'booking_no' => $row->booking_no,
                'package_name' => $row->package_name,
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
            ->first();

        $totalsPage = $this->aggregateBookingTotals($rows);
        $grandTotals = [
            'orders_count' => (int) ($summaryRow->total_transactions ?? 0),
            'gross_amount' => (float) ((clone $baseQuery)->sum('gross_amount') ?? 0),
            'discount' => (float) ((clone $baseQuery)->sum('discount') ?? 0),
            'net_amount' => (float) ($summaryRow->total_booking_revenue ?? 0),
        ];

        return [
            'summary' => [
                'total_booking_revenue' => (float) ($summaryRow->total_booking_revenue ?? 0),
                'online_booking_revenue' => (float) ($summaryRow->online_booking_revenue ?? 0),
                'offline_booking_revenue' => (float) ($summaryRow->offline_booking_revenue ?? 0),
                'total_transactions' => (int) ($summaryRow->total_transactions ?? 0),
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

        return $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
                    'order_no' => (string) $row->order_no,
                    'date_time' => (string) $row->order_datetime,
                    'customer' => (string) ($row->customer_name ?: 'Walk-in Customer'),
                    'channel' => (string) $row->channel,
                    'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                    'type' => (string) $row->type,
                    'booking_no' => $row->booking_no,
                    'package_name' => $row->package_name,
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
        ?string $status
    ) {
        $query = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->where('oi.line_type', 'product')
            ->groupBy('o.id', 'o.order_number', 'order_datetime', 'c.name', 'channel', 'o.payment_method', 'o.status')
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw('COALESCE(o.placed_at, o.created_at) as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
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
            $query->where('o.payment_method', $paymentMethod);
        }
        if ($status !== null) {
            $query->where('o.status', $status);
        }

        return DB::query()->fromSub($query, 'rows');
    }

    private function baseBookingRowsQuery(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        string $type
    ) {
        $query = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
            ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw('COALESCE(o.placed_at, o.created_at) as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
            ->selectRaw('o.status')
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' ELSE 'package_purchase' END as type")
            ->selectRaw('COALESCE(b.booking_code, CONCAT(\'BOOKING-\', oi.booking_id)) as booking_no')
            ->selectRaw('COALESCE(oi.display_name_snapshot, oi.product_name_snapshot, sp.name) as package_name')
            ->selectRaw('COALESCE(oi.line_total, 0) as gross_amount')
            ->selectRaw('COALESCE(oi.discount_amount, 0) as discount')
            ->selectRaw('COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0), 0) as net_amount');

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }
        if ($paymentMethod !== null) {
            $query->where('o.payment_method', $paymentMethod);
        }
        if ($type !== self::BOOKING_TYPE_ALL) {
            $lineType = match ($type) {
                self::BOOKING_TYPE_DEPOSIT => 'booking_deposit',
                self::BOOKING_TYPE_FINAL_SETTLEMENT => 'booking_settlement',
                self::BOOKING_TYPE_PACKAGE_PURCHASE => 'service_package',
                default => null,
            };
            if ($lineType !== null) {
                $query->where('oi.line_type', $lineType);
            }
        }

        return DB::query()->fromSub($query, 'rows');
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
            self::BOOKING_TYPE_PACKAGE_PURCHASE => self::BOOKING_TYPE_PACKAGE_PURCHASE,
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
        ];
    }
}
