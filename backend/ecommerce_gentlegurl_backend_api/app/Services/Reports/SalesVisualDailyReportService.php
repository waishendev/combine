<?php

namespace App\Services\Reports;

use App\Models\Ecommerce\PaymentGateway;
use App\Support\WorkspaceType;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Single-day CRM dashboard aggregates for the sales visual report (cards + staff).
 * Kept separate from SalesChannelReportService to avoid widening visibility of private query builders.
 */
class SalesVisualDailyReportService
{
    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'service_package'];

    public function ecommerceDay(Carbon $day): array
    {
        $start = $day->copy()->startOfDay();
        $end = $day->copy()->endOfDay();
        $validPay = SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT;
        $validOrd = SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT;

        $paymentBlock = $this->paymentMethodsForWorkspace(WorkspaceType::ECOMMERCE, $start, $end, $validPay, $validOrd);

        $lineTotal = 'COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))';

        // Catalog lines only (exclude booking_* lines so mixed orders do not leak into "other")
        $itemAgg = DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereIn('oi.line_type', ['product', 'service', 'service_package'])
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'product' THEN $lineTotal ELSE 0 END), 0) as product")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service' THEN $lineTotal ELSE 0 END), 0) as service")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service_package' THEN $lineTotal ELSE 0 END), 0) as multi_package")
            ->first();

        $channelSplit = (object) [
            'online' => $paymentBlock['totals']['online'],
            'offline' => $paymentBlock['totals']['offline'],
        ];

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $validPay, $validOrd, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->completedBookingsByStaff($start, $end));
        $staffService = $this->padStaffWithServiceCounts($roster, $svcKeyed);

        return [
            'date' => $day->toDateString(),
            'online_offline' => [
                'online' => round((float) ($channelSplit->online ?? 0), 2),
                'offline' => round((float) ($channelSplit->offline ?? 0), 2),
            ],
            'payment_methods' => $paymentBlock['rows'],
            'item_types' => [
                'estimate' => true,
                'product' => round((float) ($itemAgg->product ?? 0), 2),
                'service' => round((float) ($itemAgg->service ?? 0), 2),
                'multi_package' => round((float) ($itemAgg->multi_package ?? 0), 2),
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => 0.0,
                'message' => 'N/A for ecommerce catalog. Use Booking workspace for booking settlement totals.',
            ],
            'staff' => [
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
            ],
        ];
    }

    public function bookingDay(Carbon $day): array
    {
        $start = $day->copy()->startOfDay();
        $end = $day->copy()->endOfDay();
        $validPay = SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT;
        $validOrd = SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT;

        $paymentBlock = $this->paymentMethodsForWorkspace(WorkspaceType::BOOKING, $start, $end, $validPay, $validOrd);

        $lineTotal = 'COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))';

        $bookingSub = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
            ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.payment_method')
            ->selectRaw("$lineTotal as net_amount")
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' ELSE 'package_purchase' END as line_kind")
            ->selectRaw('oi.booking_id');

        $itemAgg = DB::query()->fromSub($bookingSub, 'r')
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind IN ('deposit','final_settlement','addon') THEN net_amount ELSE 0 END), 0) as service_bucket")
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind = 'package_purchase' THEN net_amount ELSE 0 END), 0) as multi_package")
            ->first();

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $validPay, $validOrd, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->completedBookingsByStaff($start, $end));
        $staffService = $this->padStaffWithServiceCounts($roster, $svcKeyed);

        return [
            'date' => $day->toDateString(),
            'online_offline' => [
                'online' => $paymentBlock['totals']['online'],
                'offline' => $paymentBlock['totals']['offline'],
            ],
            'payment_methods' => $paymentBlock['rows'],
            'item_types' => [
                'estimate' => true,
                'product' => 0.0,
                'service' => round((float) ($itemAgg->service_bucket ?? 0), 2),
                'multi_package' => round((float) ($itemAgg->multi_package ?? 0), 2),
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => round((float) DB::table('order_items as oi')
                    ->join('orders as o', 'o.id', '=', 'oi.order_id')
                    ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
                    ->whereIn('o.payment_status', $validPay)
                    ->whereIn('o.status', $validOrd)
                    ->where('oi.line_type', 'booking_settlement')
                    ->selectRaw("COALESCE(SUM($lineTotal), 0) as v")
                    ->value('v'), 2),
                'message' => 'Final settlement lines for booking orders on this day.',
            ],
            'staff' => [
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
            ],
        ];
    }

    /**
     * Mixed workspace: ecommerce catalog + booking lines, payment by gateway where the order has
     * at least one product or booking line (order grand_total counted once per gateway).
     */
    public function allDay(Carbon $day): array
    {
        $start = $day->copy()->startOfDay();
        $end = $day->copy()->endOfDay();
        $validPay = SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT;
        $validOrd = SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT;

        $paymentBlock = $this->paymentMethodsForAllWorkspace($start, $end, $validPay, $validOrd);
        $lineTotal = 'COALESCE(oi.line_total_after_discount, oi.line_total - COALESCE(oi.discount_amount, 0))';

        $itemEcommerce = DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereIn('oi.line_type', ['product', 'service', 'service_package'])
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'product' THEN $lineTotal ELSE 0 END), 0) as product")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service' THEN $lineTotal ELSE 0 END), 0) as service")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service_package' THEN $lineTotal ELSE 0 END), 0) as multi_package")
            ->first();

        $bookingSub = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
            ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.payment_method')
            ->selectRaw("$lineTotal as net_amount")
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' ELSE 'package_purchase' END as line_kind")
            ->selectRaw('oi.booking_id');

        $itemBooking = DB::query()->fromSub($bookingSub, 'r')
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind IN ('deposit','final_settlement','addon') THEN net_amount ELSE 0 END), 0) as service_bucket")
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind = 'package_purchase' THEN net_amount ELSE 0 END), 0) as multi_package")
            ->first();

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $validPay, $validOrd, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->completedBookingsByStaff($start, $end));
        $staffService = $this->padStaffWithServiceCounts($roster, $svcKeyed);

        $serviceConsumedAmount = round((float) DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->where('oi.line_type', 'booking_settlement')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as v")
            ->value('v'), 2);

        return [
            'date' => $day->toDateString(),
            'online_offline' => [
                'online' => $paymentBlock['totals']['online'],
                'offline' => $paymentBlock['totals']['offline'],
            ],
            'payment_methods' => $paymentBlock['rows'],
            'item_types' => [
                'estimate' => true,
                'product' => round((float) ($itemEcommerce->product ?? 0), 2),
                'service' => round((float) ($itemEcommerce->service ?? 0) + (float) ($itemBooking->service_bucket ?? 0), 2),
                'multi_package' => round((float) ($itemEcommerce->multi_package ?? 0) + (float) ($itemBooking->multi_package ?? 0), 2),
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => $serviceConsumedAmount,
                'message' => 'Final settlement lines for booking orders on this day.',
            ],
            'staff' => [
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
            ],
        ];
    }

    /** @return list<array{staff_id: int, name: string}> */
    private function allStaffRoster(): array
    {
        return DB::table('staffs')
            ->orderBy('name')
            ->select('id', 'name')
            ->get()
            ->map(fn ($r) => [
                'staff_id' => (int) $r->id,
                'name' => (string) $r->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function keyRowsByStaffId(array $rows): array
    {
        $by = [];
        foreach ($rows as $r) {
            $id = (int) ($r['staff_id'] ?? 0);
            if ($id > 0) {
                $by[$id] = $r;
            }
        }

        return $by;
    }

    /**
     * @param  list<array{staff_id: int, name: string}>  $roster
     * @param  array<int, array<string, mixed>>  $byId  keyed by staff_id from ecommerceStaffProductSales
     * @return list<array{staff_id: int, name: string, product_sales: float, total: float}>
     */
    private function padStaffWithEcommerceProductSales(array $roster, array $byId): array
    {
        $out = [];
        foreach ($roster as $s) {
            $id = $s['staff_id'];
            $amt = isset($byId[$id]) ? (float) ($byId[$id]['product_sales'] ?? $byId[$id]['total'] ?? 0) : 0.0;
            $out[] = [
                'staff_id' => $id,
                'name' => $s['name'],
                'product_sales' => round($amt, 2),
                'total' => round($amt, 2),
            ];
        }

        return $out;
    }

    /**
     * @param  list<array{staff_id: int, name: string}>  $roster
     * @param  array<int, array<string, mixed>>  $byId  keyed by staff_id from completedBookingsByStaff
     * @return list<array{staff_id: int, name: string, service_count: int}>
     */
    private function padStaffWithServiceCounts(array $roster, array $byId): array
    {
        $out = [];
        foreach ($roster as $s) {
            $id = $s['staff_id'];
            $cnt = isset($byId[$id]) ? (int) ($byId[$id]['service_count'] ?? 0) : 0;
            $out[] = [
                'staff_id' => $id,
                'name' => $s['name'],
                'service_count' => $cnt,
            ];
        }

        return $out;
    }

    private function ecommerceStaffProductSales(Carbon $start, Carbon $end, array $validPay, array $validOrd, string $lineTotal): array
    {
        $rows = DB::table('order_item_staff_splits as sps')
            ->join('order_items as oi', 'oi.id', '=', 'sps.order_item_id')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->join('staffs as st', 'st.id', '=', 'sps.staff_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->where('oi.line_type', 'product')
            ->groupBy('st.id', 'st.name')
            ->orderByDesc(DB::raw('product_sales'))
            ->selectRaw('st.id as staff_id')
            ->selectRaw('st.name as staff_name')
            ->selectRaw('COALESCE(SUM(('.$lineTotal.') * (sps.share_percent / 100.0)), 0) as product_sales')
            ->get();

        return $rows->map(fn ($r) => [
            'staff_id' => (int) $r->staff_id,
            'name' => (string) $r->staff_name,
            'product_sales' => round((float) $r->product_sales, 2),
            'total' => round((float) $r->product_sales, 2),
        ])->values()->all();
    }

    /**
     * One row per configured payment gateway (type=ecommerce|booking), with online/offline split.
     * Order must belong to the workspace (product line for ecommerce; booking line for booking).
     */
    private function paymentMethodsForWorkspace(
        string $workspaceType,
        Carbon $start,
        Carbon $end,
        array $validPay,
        array $validOrd
    ): array {
        $gateways = PaymentGateway::query()
            ->where('type', $workspaceType)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['key', 'name']);

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;

        foreach ($gateways as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }

            $online = $this->sumOrderGrandTotalForGatewayKey(
                $workspaceType,
                $start,
                $end,
                $validPay,
                $validOrd,
                $key,
                true
            );
            $offline = $this->sumOrderGrandTotalForGatewayKey(
                $workspaceType,
                $start,
                $end,
                $validPay,
                $validOrd,
                $key,
                false
            );

            $sumOnline += $online;
            $sumOffline += $offline;

            $rows[] = [
                'key' => $key,
                'label' => (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key),
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        $hasCashGateway = $gateways->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $cashOnline = $this->sumOrderGrandTotalForGatewayKey(
                $workspaceType,
                $start,
                $end,
                $validPay,
                $validOrd,
                'cash',
                true
            );
            $cashOffline = $this->sumOrderGrandTotalForGatewayKey(
                $workspaceType,
                $start,
                $end,
                $validPay,
                $validOrd,
                'cash',
                false
            );
            $sumOnline += $cashOnline;
            $sumOffline += $cashOffline;
            array_unshift($rows, [
                'key' => 'cash',
                'label' => 'Cash',
                'online' => round($cashOnline, 2),
                'offline' => round($cashOffline, 2),
                'total' => round($cashOnline + $cashOffline, 2),
            ]);
        }

        return [
            'rows' => $rows,
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    private function sumOrderGrandTotalForGatewayKey(
        string $workspaceType,
        Carbon $start,
        Carbon $end,
        array $validPay,
        array $validOrd,
        string $paymentKey,
        bool $online
    ): float {
        $q = DB::table('orders as o')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereRaw('LOWER(TRIM(COALESCE(o.payment_method, \'\'))) = ?', [strtolower(trim($paymentKey))]);

        if ($online) {
            $q->whereNull('o.created_by_user_id');
        } else {
            $q->whereNotNull('o.created_by_user_id');
        }

        if ($workspaceType === WorkspaceType::ECOMMERCE) {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->where('oi.line_type', 'product');
            });
        } else {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES);
            });
        }

        return (float) $q->sum('o.grand_total');
    }

    /**
     * Union of ecommerce + booking gateway keys; sums order grand_total when the order has
     * product line(s) and/or booking line(s).
     */
    private function paymentMethodsForAllWorkspace(
        Carbon $start,
        Carbon $end,
        array $validPay,
        array $validOrd
    ): array {
        $ec = PaymentGateway::query()
            ->where('type', WorkspaceType::ECOMMERCE)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        $bk = PaymentGateway::query()
            ->where('type', WorkspaceType::BOOKING)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $merged = [];
        $seen = [];
        foreach ([$ec, $bk] as $collection) {
            foreach ($collection as $gw) {
                $k = strtolower(trim((string) $gw->key));
                if ($k === '') {
                    continue;
                }
                if (isset($seen[$k])) {
                    continue;
                }
                $seen[$k] = true;
                $merged[] = $gw;
            }
        }

        usort($merged, fn ($a, $b) => [$a->sort_order, $a->id] <=> [$b->sort_order, $b->id]);

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;

        foreach ($merged as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }

            $online = $this->sumOrderGrandTotalForGatewayKeyAll(
                $start,
                $end,
                $validPay,
                $validOrd,
                $key,
                true
            );
            $offline = $this->sumOrderGrandTotalForGatewayKeyAll(
                $start,
                $end,
                $validPay,
                $validOrd,
                $key,
                false
            );

            $sumOnline += $online;
            $sumOffline += $offline;

            $rows[] = [
                'key' => $key,
                'label' => (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key),
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        $hasCashGateway = collect($merged)->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $cashOnline = $this->sumOrderGrandTotalForGatewayKeyAll(
                $start,
                $end,
                $validPay,
                $validOrd,
                'cash',
                true
            );
            $cashOffline = $this->sumOrderGrandTotalForGatewayKeyAll(
                $start,
                $end,
                $validPay,
                $validOrd,
                'cash',
                false
            );
            $sumOnline += $cashOnline;
            $sumOffline += $cashOffline;
            array_unshift($rows, [
                'key' => 'cash',
                'label' => 'Cash',
                'online' => round($cashOnline, 2),
                'offline' => round($cashOffline, 2),
                'total' => round($cashOnline + $cashOffline, 2),
            ]);
        }

        return [
            'rows' => $rows,
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    private function sumOrderGrandTotalForGatewayKeyAll(
        Carbon $start,
        Carbon $end,
        array $validPay,
        array $validOrd,
        string $paymentKey,
        bool $online
    ): float {
        $q = DB::table('orders as o')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', $validPay)
            ->whereIn('o.status', $validOrd)
            ->whereRaw('LOWER(TRIM(COALESCE(o.payment_method, \'\'))) = ?', [strtolower(trim($paymentKey))]);

        if ($online) {
            $q->whereNull('o.created_by_user_id');
        } else {
            $q->whereNotNull('o.created_by_user_id');
        }

        $q->where(function ($outer) {
            $outer->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->where('oi.line_type', 'product');
            })->orWhereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES);
            });
        });

        return (float) $q->sum('o.grand_total');
    }

    private function completedBookingsByStaff(Carbon $start, Carbon $end): array
    {
        $rows = DB::table('bookings as b')
            ->join('staffs as st', 'st.id', '=', 'b.staff_id')
            ->whereNotNull('b.staff_id')
            ->where('b.status', 'COMPLETED')
            ->whereNotNull('b.completed_at')
            ->whereBetween('b.completed_at', [$start, $end])
            ->groupBy('st.id', 'st.name')
            ->orderByDesc(DB::raw('service_count'))
            ->selectRaw('st.id as staff_id')
            ->selectRaw('st.name as staff_name')
            ->selectRaw('COUNT(*) as service_count')
            ->get();

        return $rows->map(fn ($r) => [
            'staff_id' => (int) $r->staff_id,
            'name' => (string) $r->staff_name,
            'service_count' => (int) $r->service_count,
        ])->values()->all();
    }

}
