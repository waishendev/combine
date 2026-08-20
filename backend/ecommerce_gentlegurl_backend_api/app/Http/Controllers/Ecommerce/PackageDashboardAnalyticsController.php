<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\MemoizesSchemaLookups;
use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\Reports\ReportBranchScope;

class PackageDashboardAnalyticsController extends Controller
{
    use MemoizesSchemaLookups;

    public function summary(Request $request)
    {
        return response()->json($this->buildSummaryPayload($request));
    }

    /**
     * @param  bool  $forOverview  Slim first-paint fields only (CRM /dashboard).
     * @return array<string, mixed>
     */
    public function buildSummaryPayload(Request $request, bool $forOverview = false): array
    {
        $this->warmPackageSchema();

        if (! $this->hasPackageTables()) {
            return $this->emptySummary($forOverview);
        }

        $templates = DB::table('service_packages')->selectRaw('COUNT(*) total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) active, SUM(CASE WHEN is_active THEN 0 ELSE 1 END) inactive')->first();
        $activePackageIdsWithRemaining = DB::table('customer_service_package_balances')->select('customer_service_package_id')->where('remaining_qty', '>', 0);

        $balanceValue = $this->balanceRedemptionValueExpression();
        $usageValue = $this->usageRedemptionValueExpression();
        // Aggregate-only path: booking_services join is unused (no service-name select).
        $balanceSelect = $forOverview
            ? "SUM(b.remaining_qty) remaining_redemptions, SUM(b.remaining_qty * {$balanceValue}) outstanding_service_value"
            : "SUM(b.remaining_qty) remaining_redemptions, SUM(b.remaining_qty * {$balanceValue}) outstanding_service_value, SUM(CASE WHEN b.remaining_qty > 0 AND {$this->balanceRedemptionRawExpression()} IS NULL THEN 1 ELSE 0 END) missing_redemption_value_count";
        $balances = $this->balanceValueQuery(withServiceName: false)->where('csp.status', 'active')->where(fn ($q) => $q->whereNull('csp.expires_at')->orWhere('csp.expires_at', '>=', now()))
            ->selectRaw($balanceSelect)
            ->first();

        $sales = $this->packageSalesTotals();
        $redemptionSelect = $forOverview
            ? "SUM(u.used_qty * {$usageValue}) redeemed_value"
            : "SUM(u.used_qty) redeemed_qty, SUM(u.used_qty * {$usageValue}) redeemed_value";
        $redemptionsQuery = $this->usageValueQuery(withServiceName: false)->selectRaw($redemptionSelect);
        if ($this->schemaHasColumn('customer_service_package_usages', 'status')) {
            $redemptionsQuery->whereIn('u.status', $this->completedUsageStatuses());
        }
        $redemptions = $redemptionsQuery->first();

        $activeCountSelect = $forOverview
            ? 'COUNT(DISTINCT csp.customer_id) as active_holders'
            : 'COUNT(DISTINCT csp.customer_id) as active_holders, COUNT(*) as active_customer_packages';
        $activeCounts = DB::table('customer_service_packages as csp')
            ->where('csp.status', 'active')
            ->where(fn ($q) => $q->whereNull('csp.expires_at')->orWhere('csp.expires_at', '>=', now()))
            ->whereIn('csp.id', $activePackageIdsWithRemaining)
            ->selectRaw($activeCountSelect)
            ->first();

        if ($forOverview) {
            return [
                'templates' => [
                    'total' => (int) ($templates->total ?? 0),
                    'active' => (int) ($templates->active ?? 0),
                    'inactive' => (int) ($templates->inactive ?? 0),
                ],
                'customers' => [
                    'active_holders' => (int) ($activeCounts->active_holders ?? 0),
                ],
                'balances' => [
                    'remaining_redemptions' => (int) ($balances->remaining_redemptions ?? 0),
                    'outstanding_service_value' => round((float) ($balances->outstanding_service_value ?? 0), 2),
                ],
                'sales' => [
                    'net_package_sales' => round((float) ($sales->net ?? 0), 2),
                ],
                'redemptions' => [
                    'redeemed_value' => round((float) ($redemptions->redeemed_value ?? 0), 2),
                ],
            ];
        }

        $expiringDays = max(1, (int) $request->query('expiring_days', 30));
        $status = DB::table('customer_service_packages as csp')->selectRaw("SUM(CASE WHEN status = 'active' AND expires_at BETWEEN ? AND ? THEN 1 ELSE 0 END) expiring_soon, SUM(CASE WHEN status = 'exhausted' THEN 1 ELSE 0 END) exhausted, SUM(CASE WHEN status = 'expired' OR (status = 'active' AND expires_at < ?) THEN 1 ELSE 0 END) expired, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) cancelled", [now(), now()->addDays($expiringDays), now()])->first();

        return [
            'templates' => ['total' => (int) ($templates->total ?? 0), 'active' => (int) ($templates->active ?? 0), 'inactive' => (int) ($templates->inactive ?? 0), 'missing_redemption_value_count' => (int) ($balances->missing_redemption_value_count ?? 0)],
            'customers' => ['active_holders' => (int) ($activeCounts->active_holders ?? 0), 'active_customer_packages' => (int) ($activeCounts->active_customer_packages ?? 0)],
            'balances' => ['remaining_redemptions' => (int) ($balances->remaining_redemptions ?? 0), 'outstanding_service_value' => round((float) ($balances->outstanding_service_value ?? 0), 2)],
            'sales' => ['gross_package_sales' => round((float) ($sales->gross ?? 0), 2), 'refund_amount' => round((float) ($sales->refunds ?? 0), 2), 'net_package_sales' => round((float) ($sales->net ?? 0), 2)],
            'redemptions' => ['redeemed_qty' => (int) ($redemptions->redeemed_qty ?? 0), 'redeemed_value' => round((float) ($redemptions->redeemed_value ?? 0), 2)],
            'status' => ['expiring_soon' => (int) ($status->expiring_soon ?? 0), 'exhausted' => (int) ($status->exhausted ?? 0), 'expired' => (int) ($status->expired ?? 0), 'cancelled' => (int) ($status->cancelled ?? 0)],
        ];
    }

    public function customerPackages(Request $request)
    {
        return response()->json($this->buildCustomerPackagesPayload($request));
    }

    /**
     * @param  bool  $forOverview  Slim first-paint fields only (CRM /dashboard).
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator|array{data: array<int, mixed>, current_page?: int, last_page?: int, total?: int}
     */
    public function buildCustomerPackagesPayload(Request $request, bool $forOverview = false): mixed
    {
        $this->warmPackageSchema();

        if (! $this->hasPackageTables()) {
            return $forOverview
                ? ['data' => [], 'current_page' => 1, 'last_page' => 1, 'total' => 0]
                : ['data' => []];
        }
        $value = $this->balanceRedemptionValueExpression();
        $rawValue = $this->balanceRedemptionRawExpression();
        // List select has no per-service name — skip booking_services join.
        $query = $this->balanceValueQuery(withServiceName: false)
            ->join('customers as c', 'c.id', '=', 'csp.customer_id')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id');

        if ($forOverview) {
            // Overview table does not render reserved_qty / purchase_reference / started_at.
            $query->selectRaw("csp.id, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from, csp.created_at purchase_date, csp.expires_at, csp.status, {$this->purchaseAmountExpression()} purchase_amount, COALESCE(SUM(b.total_qty), 0) total_qty, COALESCE(SUM(b.used_qty), 0) used_qty, COALESCE(SUM(b.remaining_qty), 0) remaining_qty, COALESCE(SUM(b.remaining_qty * {$value}), 0) remaining_service_value, SUM(CASE WHEN b.remaining_qty > 0 AND {$rawValue} IS NULL THEN 1 ELSE 0 END) missing_values")
                ->groupBy('csp.id', 'c.name', 'sp.name', 'sp.selling_price', 'csp.purchased_from', 'csp.created_at', 'csp.expires_at', 'csp.status');
            foreach (['package_name_snapshot', 'purchase_amount_snapshot'] as $groupColumn) {
                if ($this->hasCsp($groupColumn)) {
                    $query->groupBy('csp.'.$groupColumn);
                }
            }
        } else {
            $query->leftJoinSub($this->reservedQtyAggregateQuery(), 'reserved_agg', 'reserved_agg.customer_service_package_id', '=', 'csp.id')
                ->selectRaw("csp.id, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from, {$this->purchaseReferenceExpression()} purchase_reference, csp.created_at purchase_date, csp.started_at, csp.expires_at, csp.status, {$this->purchaseAmountExpression()} purchase_amount, COALESCE(SUM(b.total_qty), 0) total_qty, COALESCE(SUM(b.used_qty), 0) used_qty, COALESCE(MAX(reserved_agg.reserved_qty), 0) reserved_qty, COALESCE(SUM(b.remaining_qty), 0) remaining_qty, COALESCE(SUM(b.remaining_qty * {$value}), 0) remaining_service_value, SUM(CASE WHEN b.remaining_qty > 0 AND {$rawValue} IS NULL THEN 1 ELSE 0 END) missing_values")
                ->groupBy('csp.id', 'c.name', 'sp.name', 'sp.selling_price', 'csp.purchased_from', 'csp.created_at', 'csp.started_at', 'csp.expires_at', 'csp.status');
            foreach (['package_name_snapshot', 'purchase_amount_snapshot', 'purchase_reference_snapshot'] as $groupColumn) {
                if ($this->hasCsp($groupColumn)) {
                    $query->groupBy('csp.'.$groupColumn);
                }
            }
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(fn ($q) => $q->where('c.name', 'like', "%{$search}%")->orWhere('sp.name', 'like', "%{$search}%"));
        }
        if ($request->filled('customer_id')) {
            $query->where('c.id', (int) $request->query('customer_id'));
        }
        if ($request->filled('service_package_id')) {
            $query->where('csp.service_package_id', (int) $request->query('service_package_id'));
        }
        if ($request->filled('status')) {
            $query->where('csp.status', $request->query('status'));
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        if (! $forOverview) {
            return $query->orderByDesc('remaining_service_value')->paginate($perPage);
        }

        $page = max((int) $request->query('page', 1), 1);
        $total = (int) DB::query()->fromSub(clone $query, 'count_sub')->count();
        $rows = (clone $query)->orderByDesc('remaining_service_value')->forPage($page, $perPage)->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'customer' => (string) $row->customer,
                'package' => (string) $row->package,
                'purchased_from' => (string) $row->purchased_from,
                'purchase_date' => $row->purchase_date,
                'expires_at' => $row->expires_at,
                'status' => (string) $row->status,
                'total_qty' => (int) $row->total_qty,
                'used_qty' => (int) $row->used_qty,
                'remaining_qty' => (int) $row->remaining_qty,
                'purchase_amount' => round((float) $row->purchase_amount, 2),
                'remaining_service_value' => round((float) $row->remaining_service_value, 2),
                'missing_values' => (int) $row->missing_values,
            ])
            ->all();

        return [
            'data' => $rows,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'total' => $total,
        ];
    }

    public function filterOptions()
    {
        return response()->json($this->buildFilterOptionsPayload());
    }

    /**
     * @return array{customers: list<array{id: int, name: string}>, packages: list<array{id: int, name: string}>}
     */
    public function buildFilterOptionsPayload(): array
    {
        $this->warmPackageSchema();

        if (! $this->hasPackageTables()) {
            return ['customers' => [], 'packages' => []];
        }

        $packageName = $this->packageNameExpression();

        $customers = DB::table('customer_service_packages as csp')
            ->join('customers as c', 'c.id', '=', 'csp.customer_id')
            ->select('c.id', 'c.name')
            ->distinct()
            ->orderBy('c.name')
            ->get()
            ->map(fn ($row) => ['id' => (int) $row->id, 'name' => (string) $row->name])
            ->values()
            ->all();

        $packages = DB::table('customer_service_packages as csp')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->selectRaw("csp.service_package_id as id, MIN({$packageName}) as name")
            ->groupBy('csp.service_package_id')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => ['id' => (int) $row->id, 'name' => (string) $row->name])
            ->values()
            ->all();

        return [
            'customers' => $customers,
            'packages' => $packages,
        ];
    }

    public function sales(Request $request)
    {
        return response()->json($this->packageSalesQuery()->orderByDesc('purchased_at')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function redemptions(Request $request)
    {
        if (! $this->hasPackageTables()) {
            return response()->json(['data' => []]);
        }
        $value = $this->usageRedemptionValueExpression();
        $rawValue = $this->usageRedemptionRawExpression();
        $usageDate = $this->schemaHasColumn('customer_service_package_usages', 'consumed_at') ? 'COALESCE(u.consumed_at, u.created_at)' : 'u.created_at';
        $status = $this->schemaHasColumn('customer_service_package_usages', 'status') ? 'u.status' : "'completed'";
        $query = $this->usageValueQuery(withServiceName: true)->join('customers as c', 'c.id', '=', 'u.customer_id')->join('customer_service_packages as csp', 'csp.id', '=', 'u.customer_service_package_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->selectRaw("u.id, {$usageDate} usage_date, {$this->usageBookingExpression()} booking_no, c.name customer, {$this->packageNameExpression()} package, {$this->usageServiceNameExpression()} service, u.used_qty, {$value} redemption_value_per_unit, u.used_qty * {$value} total_redemption_value, CASE WHEN {$rawValue} IS NULL THEN 1 ELSE 0 END missing_value, {$this->usageStaffExpression()} staff, u.used_from source, {$status} status");
        if ($this->schemaHasColumn('customer_service_package_usages', 'status')) {
            $query->whereIn('u.status', $this->completedUsageStatuses());
        }

        return response()->json($query->orderByDesc('usage_date')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function customerPackageDetail(int $id)
    {
        if (! $this->hasPackageTables()) {
            abort(404);
        }
        $package = DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->where('csp.id', $id)->selectRaw("csp.id, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from, {$this->purchaseReferenceExpression()} purchase_reference, csp.created_at purchase_date, csp.started_at, csp.expires_at, csp.status, {$this->purchaseAmountExpression()} purchase_amount, {$this->refundAmountExpression()} refunded_amount")->first();
        if (! $package) {
            abort(404);
        }
        $value = $this->balanceRedemptionValueExpression();
        $rawValue = $this->balanceRedemptionRawExpression();
        $balances = $this->balanceValueQuery(withServiceName: true)->where('b.customer_service_package_id', $id)->selectRaw("b.id, {$this->balanceServiceNameExpression()} service_name, b.total_qty, b.used_qty, b.remaining_qty, {$value} redemption_value_per_use, b.used_qty * {$value} used_value, b.remaining_qty * {$value} remaining_value, CASE WHEN {$rawValue} IS NULL THEN 1 ELSE 0 END missing_value")->get();
        $usageValue = $this->usageRedemptionValueExpression();
        $usageRaw = $this->usageRedemptionRawExpression();
        $usageDate = $this->schemaHasColumn('customer_service_package_usages', 'consumed_at') ? 'COALESCE(u.consumed_at, u.created_at)' : 'u.created_at';
        $usages = $this->usageValueQuery(withServiceName: true)->where('u.customer_service_package_id', $id)->selectRaw("u.id, {$usageDate} usage_date, {$this->usageBookingExpression()} booking_no, {$this->usageServiceNameExpression()} service_name, u.used_qty, {$usageValue} redemption_value, u.used_qty * {$usageValue} total_value, CASE WHEN {$usageRaw} IS NULL THEN 1 ELSE 0 END missing_value, {$this->usageStaffExpression()} staff, u.used_from source, ".($this->schemaHasColumn('customer_service_package_usages', 'status') ? 'u.status' : "'completed'").' status, u.notes')->orderByDesc('usage_date')->get();

        return response()->json(['package' => $package, 'balances' => $balances, 'usages' => $usages]);
    }

    /**
     * @param  bool  $withServiceName  When false, skip booking_services join (aggregate / list paths that never select bs.*).
     */
    private function balanceValueQuery(bool $withServiceName = true): Builder
    {
        $query = DB::table('customer_service_packages as csp')
            ->leftJoin('customer_service_package_balances as b', 'b.customer_service_package_id', '=', 'csp.id');

        // Snapshot column makes service_package_items unnecessary for redemption math.
        if (! $this->hasBalance('redemption_value_snapshot')) {
            $query->leftJoin('service_package_items as spi', function ($join) {
                $join->on('spi.service_package_id', '=', 'csp.service_package_id')
                    ->on('spi.booking_service_id', '=', 'b.booking_service_id');
            });
        }

        if ($withServiceName) {
            $query->leftJoin('booking_services as bs', 'bs.id', '=', 'b.booking_service_id');
        }

        return $query;
    }

    /**
     * @param  bool  $withServiceName  When false, skip booking_services join (summary aggregates).
     */
    private function usageValueQuery(bool $withServiceName = true): Builder
    {
        $query = ReportBranchScope::applyCurrent(DB::table('customer_service_package_usages as u'), 'u.store_location_id');

        // Usage snapshot is enough for redemption value; skip fallback joins.
        if (! $this->hasUsage('redemption_value_snapshot')) {
            $query->leftJoin('customer_service_packages as csp_value', 'csp_value.id', '=', 'u.customer_service_package_id')
                ->leftJoin('customer_service_package_balances as b_value', function ($join) {
                    $join->on('b_value.customer_service_package_id', '=', 'u.customer_service_package_id')
                        ->on('b_value.booking_service_id', '=', 'u.booking_service_id');
                });

            if (! $this->hasBalance('redemption_value_snapshot')) {
                $query->leftJoin('service_package_items as spi_value', function ($join) {
                    $join->on('spi_value.service_package_id', '=', 'csp_value.service_package_id')
                        ->on('spi_value.booking_service_id', '=', 'u.booking_service_id');
                });
            }
        }

        if ($withServiceName) {
            $query->leftJoin('booking_services as bs', 'bs.id', '=', 'u.booking_service_id');
        }

        return $query;
    }

    /**
     * Single aggregate for reserved qty — replaces per-row correlated SubPlan.
     * Returns empty builder when status column is absent (legacy DBs) so leftJoin yields NULL → COALESCE 0.
     */
    private function reservedQtyAggregateQuery(): Builder
    {
        if (! $this->schemaHasColumn('customer_service_package_usages', 'status')) {
            return DB::table('customer_service_package_usages')
                ->selectRaw('customer_service_package_id, 0 as reserved_qty')
                ->whereRaw('1 = 0');
        }

        return DB::table('customer_service_package_usages')
            ->selectRaw('customer_service_package_id, SUM(used_qty) as reserved_qty')
            ->where('status', 'reserved')
            ->groupBy('customer_service_package_id');
    }

    private function packageSalesTotals(): object
    {
        $purchase = $this->purchaseAmountExpression();
        $refund = $this->refundAmountExpression();

        return DB::table('customer_service_packages as csp')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->where('csp.purchased_from', '!=', 'ADMIN')
            ->selectRaw("SUM({$purchase}) as gross, SUM({$refund}) as refunds, SUM(GREATEST({$purchase} - {$refund}, 0)) as net")
            ->first();
    }

    private function packageSalesQuery()
    {
        if (! $this->schemaHasTable('order_items') || ! $this->schemaHasColumn('order_items', 'service_package_id')) {
            return $this->snapshotPackageSalesQuery();
        }
        $line = $this->schemaHasColumn('order_items', 'effective_line_total') ? 'oi.effective_line_total' : ($this->schemaHasColumn('order_items', 'line_total_snapshot') ? 'oi.line_total_snapshot' : 'oi.line_total');
        $refund = $this->schemaHasColumn('orders', 'refund_total') ? 'COALESCE(o.refund_total, 0)' : '0';
        $query = DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')->whereIn('o.payment_status', ['paid', 'completed', 'refunded', 'partially_refunded'])->whereNotIn('o.status', ['cancelled', 'voided', 'failed'])->where(function ($q) {
            $q->where(function ($inner) {
                $inner->where('oi.is_package', true)->whereNotNull('oi.service_package_id');
            });
            if ($this->schemaHasColumn('order_items', 'line_type')) {
                $q->orWhere('oi.line_type', 'service_package');
            }
        });

        return DB::query()->fromSub($query->selectRaw("o.order_number reference_no, c.name customer, COALESCE(oi.product_name_snapshot, sp.name) package, COALESCE(o.payment_provider, o.payment_method, 'Unknown') channel, o.payment_method, 'ORDER' purchased_from, {$line} gross_amount, COALESCE(o.discount_total, 0) discount, {$refund} refund_amount, GREATEST({$line} - {$refund}, 0) net_amount, o.status, COALESCE(o.paid_at, o.created_at) purchased_at"), 'sales');
    }

    private function snapshotPackageSalesQuery()
    {
        $reference = $this->hasCsp('purchase_reference_snapshot') ? "COALESCE(csp.purchase_reference_snapshot, CONCAT('CSP-', csp.id))" : "CONCAT('CSP-', csp.id)";
        $purchase = $this->purchaseAmountExpression();
        $refund = $this->refundAmountExpression();

        return DB::query()->fromSub(DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->where('csp.purchased_from', '!=', 'ADMIN')->selectRaw("csp.id, {$reference} reference_no, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from channel, NULL payment_method, csp.purchased_from, {$purchase} gross_amount, 0 discount, {$refund} refund_amount, GREATEST({$purchase} - {$refund}, 0) net_amount, csp.status, csp.created_at purchased_at"), 'sales');
    }

    private function balanceRedemptionValueExpression(): string
    {
        return 'COALESCE('.$this->balanceRedemptionRawExpression().', 0)';
    }

    private function balanceRedemptionRawExpression(): string
    {
        return $this->hasBalance('redemption_value_snapshot')
            ? 'b.redemption_value_snapshot'
            : ($this->schemaHasColumn('service_package_items', 'redemption_value') ? 'spi.redemption_value' : 'NULL');
    }

    private function usageRedemptionValueExpression(): string
    {
        return 'COALESCE('.$this->usageRedemptionRawExpression().', 0)';
    }

    private function usageRedemptionRawExpression(): string
    {
        return $this->hasUsage('redemption_value_snapshot')
            ? 'u.redemption_value_snapshot'
            : ($this->hasBalance('redemption_value_snapshot')
                ? 'b_value.redemption_value_snapshot'
                : ($this->schemaHasColumn('service_package_items', 'redemption_value') ? 'spi_value.redemption_value' : 'NULL'));
    }

    private function packageNameExpression(): string
    {
        return $this->hasCsp('package_name_snapshot') ? 'COALESCE(csp.package_name_snapshot, sp.name)' : 'sp.name';
    }

    private function purchaseReferenceExpression(): string
    {
        $cast = DB::connection()->getDriverName() === 'pgsql' ? 'CAST(csp.purchased_ref_id AS TEXT)' : 'CAST(csp.purchased_ref_id AS CHAR)';

        return $this->hasCsp('purchase_reference_snapshot') ? 'csp.purchase_reference_snapshot' : $cast;
    }

    private function purchaseAmountExpression(): string
    {
        return $this->hasCsp('purchase_amount_snapshot') ? 'COALESCE(csp.purchase_amount_snapshot, sp.selling_price)' : 'sp.selling_price';
    }

    private function refundAmountExpression(): string
    {
        return $this->hasCsp('refunded_amount_snapshot') ? 'COALESCE(csp.refunded_amount_snapshot, 0)' : '0';
    }

    private function balanceServiceNameExpression(): string
    {
        return $this->hasBalance('service_name_snapshot') ? 'COALESCE(b.service_name_snapshot, bs.name)' : 'bs.name';
    }

    private function usageServiceNameExpression(): string
    {
        return $this->hasUsage('service_name_snapshot') ? 'COALESCE(u.service_name_snapshot, bs.name)' : 'bs.name';
    }

    private function usageBookingExpression(): string
    {
        return $this->schemaHasColumn('customer_service_package_usages', 'booking_id') ? 'u.booking_id' : 'u.used_ref_id';
    }

    private function usageStaffExpression(): string
    {
        return $this->schemaHasColumn('customer_service_package_usages', 'staff_id') ? 'u.staff_id' : 'NULL';
    }

    private function hasPackageTables(): bool
    {
        return $this->schemaHasTable('service_packages')
            && $this->schemaHasTable('service_package_items')
            && $this->schemaHasTable('customer_service_packages')
            && $this->schemaHasTable('customer_service_package_balances')
            && $this->schemaHasTable('customer_service_package_usages');
    }

    private function warmPackageSchema(): void
    {
        $this->warmSchemaTables([
            'service_packages',
            'service_package_items',
            'customer_service_packages',
            'customer_service_package_balances',
            'customer_service_package_usages',
            'booking_services',
            'order_items',
            'orders',
        ]);
    }

    private function hasCsp(string $column): bool
    {
        return $this->schemaHasColumn('customer_service_packages', $column);
    }

    private function hasBalance(string $column): bool
    {
        return $this->schemaHasColumn('customer_service_package_balances', $column);
    }

    private function hasUsage(string $column): bool
    {
        return $this->schemaHasColumn('customer_service_package_usages', $column);
    }

    private function completedUsageStatuses(): array
    {
        return ['completed', 'committed', 'consumed'];
    }

    private function emptySummary(bool $forOverview = false): array
    {
        if ($forOverview) {
            return [
                'templates' => ['total' => 0, 'active' => 0, 'inactive' => 0],
                'customers' => ['active_holders' => 0],
                'balances' => ['remaining_redemptions' => 0, 'outstanding_service_value' => 0],
                'sales' => ['net_package_sales' => 0],
                'redemptions' => ['redeemed_value' => 0],
            ];
        }

        return [
            'templates' => ['total' => 0, 'active' => 0, 'inactive' => 0, 'missing_redemption_value_count' => 0],
            'customers' => ['active_holders' => 0, 'active_customer_packages' => 0],
            'balances' => ['remaining_redemptions' => 0, 'outstanding_service_value' => 0],
            'sales' => ['gross_package_sales' => 0, 'refund_amount' => 0, 'net_package_sales' => 0],
            'redemptions' => ['redeemed_qty' => 0, 'redeemed_value' => 0],
            'status' => ['expiring_soon' => 0, 'exhausted' => 0, 'expired' => 0, 'cancelled' => 0],
        ];
    }
}
