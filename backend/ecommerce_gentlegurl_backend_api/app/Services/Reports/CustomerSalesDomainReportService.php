<?php

namespace App\Services\Reports;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CustomerSalesDomainReportService
{
    public const CHANNEL_ALL = 'all';
    public const CHANNEL_ONLINE = 'online';
    public const CHANNEL_OFFLINE = 'offline';

    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'service_package'];

    public function ecommerce(Carbon $start, Carbon $end, array $filters = []): array
    {
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $top = max(1, (int) ($filters['top'] ?? 5));

        $query = $this->ecommerceBaseQuery($start, $end, $filters);

        $tops = (clone $query)
            ->orderByDesc('revenue')
            ->limit($top)
            ->get()
            ->map(fn ($row) => $this->transformEcommerceRow($row))
            ->values();

        $paginator = (clone $query)
            ->orderByDesc('revenue')
            ->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())
            ->map(fn ($row) => $this->transformEcommerceRow($row))
            ->values();

        return [
            'tops' => $tops,
            'rows' => $rows,
            'totals_page' => $this->sumEcommerceRows($rows),
            'grand_totals' => $this->sumEcommerceRows((clone $query)->get()->map(fn ($row) => $this->transformEcommerceRow($row))),
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function ecommerceRows(Carbon $start, Carbon $end, array $filters = []): Collection
    {
        return $this->ecommerceBaseQuery($start, $end, $filters)
            ->orderByDesc('revenue')
            ->cursor()
            ->map(fn ($row) => $this->transformEcommerceRow($row));
    }

    public function booking(Carbon $start, Carbon $end, array $filters = []): array
    {
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $top = max(1, (int) ($filters['top'] ?? 5));

        $query = $this->bookingBaseQuery($start, $end, $filters);

        $tops = (clone $query)
            ->orderByDesc('total_revenue')
            ->limit($top)
            ->get()
            ->map(fn ($row) => $this->transformBookingRow($row))
            ->values();

        $paginator = (clone $query)
            ->orderByDesc('total_revenue')
            ->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())
            ->map(fn ($row) => $this->transformBookingRow($row))
            ->values();

        return [
            'tops' => $tops,
            'rows' => $rows,
            'totals_page' => $this->sumBookingRows($rows),
            'grand_totals' => $this->sumBookingRows((clone $query)->get()->map(fn ($row) => $this->transformBookingRow($row))),
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function bookingRows(Carbon $start, Carbon $end, array $filters = []): Collection
    {
        return $this->bookingBaseQuery($start, $end, $filters)
            ->orderByDesc('total_revenue')
            ->cursor()
            ->map(fn ($row) => $this->transformBookingRow($row));
    }

    private function ecommerceBaseQuery(Carbon $start, Carbon $end, array $filters)
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $customer = $this->nullableString($filters['customer'] ?? null);
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);

        $query = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->where('oi.line_type', 'product')
            ->groupBy('c.id', 'c.name', 'c.email')
            ->selectRaw('COALESCE(c.id, 0) as customer_id')
            ->selectRaw("COALESCE(c.name, 'Walk-in Customer') as customer_name")
            ->selectRaw('c.email as customer_email')
            ->selectRaw('COUNT(DISTINCT o.id) as orders_count')
            ->selectRaw('COALESCE(SUM(oi.quantity), 0) as items_count')
            ->selectRaw('COALESCE(SUM(COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))), 0) as revenue')
            ->selectRaw('COALESCE(SUM(COALESCE(oi.cost_amount_snapshot, oi.quantity * COALESCE(oi.variant_cost_snapshot, oi.cost_price_snapshot, 0))), 0) as cogs')
            ->selectRaw("COALESCE(MAX(COALESCE(o.placed_at, o.created_at)), MAX(o.created_at)) as last_purchase_date");

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        } elseif ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }

        if ($paymentMethod !== null) {
            $query->where('o.payment_method', $paymentMethod);
        }

        if ($status !== null) {
            $query->where('o.status', $status);
        }

        if ($customer !== null) {
            $like = '%'.mb_strtolower($customer).'%';
            $query->where(function ($sub) use ($like) {
                $sub->whereRaw("LOWER(COALESCE(c.name, '')) LIKE ?", [$like])
                    ->orWhereRaw("LOWER(COALESCE(c.email, '')) LIKE ?", [$like]);
            });
        }

        return $query;
    }

    private function bookingBaseQuery(Carbon $start, Carbon $end, array $filters)
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $customer = $this->nullableString($filters['customer'] ?? null);
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);

        $query = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->groupBy('c.id', 'c.name', 'c.email')
            ->selectRaw('COALESCE(c.id, 0) as customer_id')
            ->selectRaw("COALESCE(c.name, 'Walk-in Customer') as customer_name")
            ->selectRaw('c.email as customer_email')
            ->selectRaw('COUNT(oi.id) as transactions_count')
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'booking_deposit' THEN COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0)) ELSE 0 END), 0) as booking_deposit_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'booking_settlement' THEN COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0)) ELSE 0 END), 0) as booking_settlement_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'booking_addon' THEN COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0)) ELSE 0 END), 0) as addon_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service_package' THEN COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0)) ELSE 0 END), 0) as package_purchase_amount")
            ->selectRaw('COALESCE(SUM(COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))), 0) as total_revenue')
            ->selectRaw("COALESCE(MAX(COALESCE(o.placed_at, o.created_at)), MAX(o.created_at)) as last_transaction_date");

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        } elseif ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }

        if ($paymentMethod !== null) {
            $query->where('o.payment_method', $paymentMethod);
        }

        if ($status !== null) {
            $query->where('o.status', $status);
        }

        if ($customer !== null) {
            $like = '%'.mb_strtolower($customer).'%';
            $query->where(function ($sub) use ($like) {
                $sub->whereRaw("LOWER(COALESCE(c.name, '')) LIKE ?", [$like])
                    ->orWhereRaw("LOWER(COALESCE(c.email, '')) LIKE ?", [$like]);
            });
        }

        return $query;
    }

    private function transformEcommerceRow(object $row): array
    {
        $revenue = (float) ($row->revenue ?? 0);
        $cogs = (float) ($row->cogs ?? 0);

        return [
            'customer_id' => (int) ($row->customer_id ?? 0),
            'customer_name' => (string) ($row->customer_name ?? 'Walk-in Customer'),
            'customer_email' => $row->customer_email,
            'orders_count' => (int) ($row->orders_count ?? 0),
            'items_count' => (int) ($row->items_count ?? 0),
            'revenue' => $revenue,
            'cogs' => $cogs,
            'gross_profit' => $revenue - $cogs,
            'last_purchase_date' => $row->last_purchase_date,
        ];
    }

    private function transformBookingRow(object $row): array
    {
        return [
            'customer_id' => (int) ($row->customer_id ?? 0),
            'customer_name' => (string) ($row->customer_name ?? 'Walk-in Customer'),
            'customer_email' => $row->customer_email,
            'transactions_count' => (int) ($row->transactions_count ?? 0),
            'booking_deposit_amount' => (float) ($row->booking_deposit_amount ?? 0),
            'booking_settlement_amount' => (float) ($row->booking_settlement_amount ?? 0),
            'addon_revenue' => (float) ($row->addon_revenue ?? 0),
            'package_purchase_amount' => (float) ($row->package_purchase_amount ?? 0),
            'total_revenue' => (float) ($row->total_revenue ?? 0),
            'last_transaction_date' => $row->last_transaction_date,
        ];
    }

    private function sumEcommerceRows(Collection $rows): array
    {
        return [
            'revenue' => (float) $rows->sum('revenue'),
            'cogs' => (float) $rows->sum('cogs'),
            'gross_profit' => (float) $rows->sum('gross_profit'),
        ];
    }

    private function sumBookingRows(Collection $rows): array
    {
        return [
            'booking_deposit_amount' => (float) $rows->sum('booking_deposit_amount'),
            'booking_settlement_amount' => (float) $rows->sum('booking_settlement_amount'),
            'addon_revenue' => (float) $rows->sum('addon_revenue'),
            'package_purchase_amount' => (float) $rows->sum('package_purchase_amount'),
            'total_revenue' => (float) $rows->sum('total_revenue'),
        ];
    }

    private function normalizeChannel(string $channel): string
    {
        return match (strtolower(trim($channel))) {
            self::CHANNEL_ONLINE => self::CHANNEL_ONLINE,
            self::CHANNEL_OFFLINE => self::CHANNEL_OFFLINE,
            default => self::CHANNEL_ALL,
        };
    }

    private function nullableString(mixed $value): ?string
    {
        $string = is_string($value) ? trim($value) : '';

        return $string === '' || strtolower($string) === 'all' ? null : $string;
    }
}
