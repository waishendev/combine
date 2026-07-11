<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PackageDashboardAnalyticsController extends Controller
{
    public function summary(Request $request)
    {
        if (! $this->hasPackageTables()) {
            return response()->json($this->emptySummary());
        }

        $expiringDays = max(1, (int) $request->query('expiring_days', 30));
        $templates = DB::table('service_packages')->selectRaw('COUNT(*) total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) active, SUM(CASE WHEN is_active THEN 0 ELSE 1 END) inactive')->first();
        $activePackageIdsWithRemaining = DB::table('customer_service_package_balances')->select('customer_service_package_id')->where('remaining_qty', '>', 0);
        $activePackages = DB::table('customer_service_packages as csp')->where('csp.status', 'active')->where(fn ($q) => $q->whereNull('csp.expires_at')->orWhere('csp.expires_at', '>=', now()))->whereIn('csp.id', $activePackageIdsWithRemaining);

        $balanceValue = $this->balanceRedemptionValueExpression();
        $usageValue = $this->usageRedemptionValueExpression();
        $balances = $this->balanceValueQuery()->where('csp.status', 'active')->where(fn ($q) => $q->whereNull('csp.expires_at')->orWhere('csp.expires_at', '>=', now()))
            ->selectRaw("SUM(b.remaining_qty) remaining_redemptions, SUM(b.remaining_qty * {$balanceValue}) outstanding_service_value, SUM(CASE WHEN b.remaining_qty > 0 AND {$this->balanceRedemptionRawExpression()} IS NULL THEN 1 ELSE 0 END) missing_redemption_value_count")
            ->first();

        $sales = $this->packageSalesQuery()->selectRaw('SUM(gross_amount) gross, SUM(refund_amount) refunds, SUM(net_amount) net')->first();
        $redemptionsQuery = $this->usageValueQuery()->selectRaw("SUM(u.used_qty) redeemed_qty, SUM(u.used_qty * {$usageValue}) redeemed_value");
        if (Schema::hasColumn('customer_service_package_usages', 'status')) {
            $redemptionsQuery->whereIn('u.status', $this->completedUsageStatuses());
        }
        $redemptions = $redemptionsQuery->first();
        $status = DB::table('customer_service_packages as csp')->selectRaw("SUM(CASE WHEN status = 'active' AND expires_at BETWEEN ? AND ? THEN 1 ELSE 0 END) expiring_soon, SUM(CASE WHEN status = 'exhausted' THEN 1 ELSE 0 END) exhausted, SUM(CASE WHEN status = 'expired' OR (status = 'active' AND expires_at < ?) THEN 1 ELSE 0 END) expired, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) cancelled", [now(), now()->addDays($expiringDays), now()])->first();

        return response()->json([
            'templates' => ['total' => (int) ($templates->total ?? 0), 'active' => (int) ($templates->active ?? 0), 'inactive' => (int) ($templates->inactive ?? 0), 'missing_redemption_value_count' => (int) ($balances->missing_redemption_value_count ?? 0)],
            'customers' => ['active_holders' => (int) (clone $activePackages)->distinct('csp.customer_id')->count('csp.customer_id'), 'active_customer_packages' => (int) (clone $activePackages)->count()],
            'balances' => ['remaining_redemptions' => (int) ($balances->remaining_redemptions ?? 0), 'outstanding_service_value' => round((float) ($balances->outstanding_service_value ?? 0), 2)],
            'sales' => ['gross_package_sales' => round((float) ($sales->gross ?? 0), 2), 'refund_amount' => round((float) ($sales->refunds ?? 0), 2), 'net_package_sales' => round((float) ($sales->net ?? 0), 2)],
            'redemptions' => ['redeemed_qty' => (int) ($redemptions->redeemed_qty ?? 0), 'redeemed_value' => round((float) ($redemptions->redeemed_value ?? 0), 2)],
            'status' => ['expiring_soon' => (int) ($status->expiring_soon ?? 0), 'exhausted' => (int) ($status->exhausted ?? 0), 'expired' => (int) ($status->expired ?? 0), 'cancelled' => (int) ($status->cancelled ?? 0)],
        ]);
    }

    public function customerPackages(Request $request)
    {
        if (! $this->hasPackageTables()) return response()->json(['data' => []]);
        $value = $this->balanceRedemptionValueExpression();
        $rawValue = $this->balanceRedemptionRawExpression();
        $query = $this->balanceValueQuery()
            ->join('customers as c', 'c.id', '=', 'csp.customer_id')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->selectRaw("csp.id, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from, {$this->purchaseReferenceExpression()} purchase_reference, csp.created_at purchase_date, csp.started_at, csp.expires_at, csp.status, {$this->purchaseAmountExpression()} purchase_amount, COALESCE(SUM(b.total_qty), 0) total_qty, COALESCE(SUM(b.used_qty), 0) used_qty, {$this->reservedQtySubquery()} reserved_qty, COALESCE(SUM(b.remaining_qty), 0) remaining_qty, COALESCE(SUM(b.remaining_qty * {$value}), 0) remaining_service_value, SUM(CASE WHEN b.remaining_qty > 0 AND {$rawValue} IS NULL THEN 1 ELSE 0 END) missing_values")
            ->groupBy('csp.id', 'c.name', 'sp.name', 'sp.selling_price', 'csp.purchased_from', 'csp.created_at', 'csp.started_at', 'csp.expires_at', 'csp.status');
        foreach (['package_name_snapshot', 'purchase_amount_snapshot', 'purchase_reference_snapshot'] as $groupColumn) {
            if ($this->hasCsp($groupColumn)) {
                $query->groupBy('csp.'.$groupColumn);
            }
        }
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') $query->where(fn ($q) => $q->where('c.name', 'like', "%{$search}%")->orWhere('sp.name', 'like', "%{$search}%"));
        if ($request->filled('status')) $query->where('csp.status', $request->query('status'));
        return response()->json($query->orderByDesc('remaining_service_value')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function sales(Request $request)
    {
        return response()->json($this->packageSalesQuery()->orderByDesc('purchased_at')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function redemptions(Request $request)
    {
        if (! $this->hasPackageTables()) return response()->json(['data' => []]);
        $value = $this->usageRedemptionValueExpression();
        $rawValue = $this->usageRedemptionRawExpression();
        $usageDate = Schema::hasColumn('customer_service_package_usages', 'consumed_at') ? 'COALESCE(u.consumed_at, u.created_at)' : 'u.created_at';
        $status = Schema::hasColumn('customer_service_package_usages', 'status') ? 'u.status' : "'completed'";
        $query = $this->usageValueQuery()->join('customers as c', 'c.id', '=', 'u.customer_id')->join('customer_service_packages as csp', 'csp.id', '=', 'u.customer_service_package_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->selectRaw("u.id, {$usageDate} usage_date, {$this->usageBookingExpression()} booking_no, c.name customer, {$this->packageNameExpression()} package, {$this->usageServiceNameExpression()} service, u.used_qty, {$value} redemption_value_per_unit, u.used_qty * {$value} total_redemption_value, CASE WHEN {$rawValue} IS NULL THEN 1 ELSE 0 END missing_value, {$this->usageStaffExpression()} staff, u.used_from source, {$status} status");
        if (Schema::hasColumn('customer_service_package_usages', 'status')) $query->whereIn('u.status', $this->completedUsageStatuses());
        return response()->json($query->orderByDesc('usage_date')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function customerPackageDetail(int $id)
    {
        if (! $this->hasPackageTables()) abort(404);
        $package = DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->where('csp.id', $id)->selectRaw("csp.id, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from, {$this->purchaseReferenceExpression()} purchase_reference, csp.created_at purchase_date, csp.started_at, csp.expires_at, csp.status, {$this->purchaseAmountExpression()} purchase_amount, {$this->refundAmountExpression()} refunded_amount")->first();
        if (! $package) abort(404);
        $value = $this->balanceRedemptionValueExpression();
        $rawValue = $this->balanceRedemptionRawExpression();
        $balances = $this->balanceValueQuery()->where('b.customer_service_package_id', $id)->selectRaw("b.id, {$this->balanceServiceNameExpression()} service_name, b.total_qty, b.used_qty, b.remaining_qty, {$value} redemption_value_per_use, b.used_qty * {$value} used_value, b.remaining_qty * {$value} remaining_value, CASE WHEN {$rawValue} IS NULL THEN 1 ELSE 0 END missing_value")->get();
        $usageValue = $this->usageRedemptionValueExpression();
        $usageRaw = $this->usageRedemptionRawExpression();
        $usageDate = Schema::hasColumn('customer_service_package_usages', 'consumed_at') ? 'COALESCE(u.consumed_at, u.created_at)' : 'u.created_at';
        $usages = $this->usageValueQuery()->where('u.customer_service_package_id', $id)->selectRaw("u.id, {$usageDate} usage_date, {$this->usageBookingExpression()} booking_no, {$this->usageServiceNameExpression()} service_name, u.used_qty, {$usageValue} redemption_value, u.used_qty * {$usageValue} total_value, CASE WHEN {$usageRaw} IS NULL THEN 1 ELSE 0 END missing_value, {$this->usageStaffExpression()} staff, u.used_from source, ".(Schema::hasColumn('customer_service_package_usages', 'status') ? 'u.status' : "'completed'")." status, u.notes")->orderByDesc('usage_date')->get();
        return response()->json(['package' => $package, 'balances' => $balances, 'usages' => $usages]);
    }

    private function balanceValueQuery() { return DB::table('customer_service_packages as csp')->leftJoin('customer_service_package_balances as b', 'b.customer_service_package_id', '=', 'csp.id')->leftJoin('service_package_items as spi', function ($join) { $join->on('spi.service_package_id', '=', 'csp.service_package_id')->on('spi.booking_service_id', '=', 'b.booking_service_id'); })->leftJoin('booking_services as bs', 'bs.id', '=', 'b.booking_service_id'); }
    private function usageValueQuery() { return DB::table('customer_service_package_usages as u')->leftJoin('customer_service_packages as csp_value', 'csp_value.id', '=', 'u.customer_service_package_id')->leftJoin('customer_service_package_balances as b_value', function ($join) { $join->on('b_value.customer_service_package_id', '=', 'u.customer_service_package_id')->on('b_value.booking_service_id', '=', 'u.booking_service_id'); })->leftJoin('service_package_items as spi_value', function ($join) { $join->on('spi_value.service_package_id', '=', 'csp_value.service_package_id')->on('spi_value.booking_service_id', '=', 'u.booking_service_id'); })->leftJoin('booking_services as bs', 'bs.id', '=', 'u.booking_service_id'); }
    private function packageSalesQuery() { if (! Schema::hasTable('order_items') || ! Schema::hasColumn('order_items', 'service_package_id')) return $this->snapshotPackageSalesQuery(); $line = Schema::hasColumn('order_items', 'effective_line_total') ? 'oi.effective_line_total' : (Schema::hasColumn('order_items', 'line_total_snapshot') ? 'oi.line_total_snapshot' : 'oi.line_total'); $refund = Schema::hasColumn('orders', 'refund_total') ? 'COALESCE(o.refund_total, 0)' : '0'; return DB::query()->fromSub(DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')->where('oi.is_package', true)->whereNotNull('oi.service_package_id')->whereIn('o.payment_status', ['paid','completed','refunded','partially_refunded'])->whereNotIn('o.status', ['cancelled','voided','failed'])->selectRaw("o.order_number reference_no, c.name customer, COALESCE(oi.product_name_snapshot, sp.name) package, COALESCE(o.payment_provider, o.payment_method, 'Unknown') channel, o.payment_method, 'ORDER' purchased_from, {$line} gross_amount, COALESCE(o.discount_total, 0) discount, {$refund} refund_amount, GREATEST({$line} - {$refund}, 0) net_amount, o.status, COALESCE(o.paid_at, o.created_at) purchased_at"), 'sales'); }
    private function snapshotPackageSalesQuery() { $reference = $this->hasCsp('purchase_reference_snapshot') ? "COALESCE(csp.purchase_reference_snapshot, CONCAT('CSP-', csp.id))" : "CONCAT('CSP-', csp.id)"; $purchase = $this->hasCsp('purchase_amount_snapshot') ? 'COALESCE(csp.purchase_amount_snapshot, 0)' : '0'; $refund = $this->hasCsp('refunded_amount_snapshot') ? 'COALESCE(csp.refunded_amount_snapshot, 0)' : '0'; return DB::query()->fromSub(DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->where('csp.purchased_from', '!=', 'ADMIN')->selectRaw("csp.id, {$reference} reference_no, c.name customer, {$this->packageNameExpression()} package, csp.purchased_from channel, NULL payment_method, csp.purchased_from, {$purchase} gross_amount, 0 discount, {$refund} refund_amount, GREATEST({$purchase} - {$refund}, 0) net_amount, csp.status, csp.created_at purchased_at"), 'sales'); }

    private function balanceRedemptionValueExpression(): string { return 'COALESCE('.$this->balanceRedemptionRawExpression().', 0)'; }
    private function balanceRedemptionRawExpression(): string { return $this->hasBalance('redemption_value_snapshot') ? 'b.redemption_value_snapshot' : (Schema::hasColumn('service_package_items', 'redemption_value') ? 'spi.redemption_value' : 'NULL'); }
    private function usageRedemptionValueExpression(): string { return 'COALESCE('.$this->usageRedemptionRawExpression().', 0)'; }
    private function usageRedemptionRawExpression(): string { return $this->hasUsage('redemption_value_snapshot') ? 'u.redemption_value_snapshot' : ($this->hasBalance('redemption_value_snapshot') ? 'b_value.redemption_value_snapshot' : (Schema::hasColumn('service_package_items', 'redemption_value') ? 'spi_value.redemption_value' : 'NULL')); }
    private function packageNameExpression(): string { return $this->hasCsp('package_name_snapshot') ? 'COALESCE(csp.package_name_snapshot, sp.name)' : 'sp.name'; }
    private function purchaseReferenceExpression(): string { $cast = DB::connection()->getDriverName() === 'pgsql' ? 'CAST(csp.purchased_ref_id AS TEXT)' : 'CAST(csp.purchased_ref_id AS CHAR)'; return $this->hasCsp('purchase_reference_snapshot') ? 'csp.purchase_reference_snapshot' : $cast; }
    private function purchaseAmountExpression(): string { return $this->hasCsp('purchase_amount_snapshot') ? 'COALESCE(csp.purchase_amount_snapshot, sp.selling_price)' : 'sp.selling_price'; }
    private function refundAmountExpression(): string { return $this->hasCsp('refunded_amount_snapshot') ? 'COALESCE(csp.refunded_amount_snapshot, 0)' : '0'; }
    private function balanceServiceNameExpression(): string { return $this->hasBalance('service_name_snapshot') ? 'COALESCE(b.service_name_snapshot, bs.name)' : 'bs.name'; }
    private function usageServiceNameExpression(): string { return $this->hasUsage('service_name_snapshot') ? 'COALESCE(u.service_name_snapshot, bs.name)' : 'bs.name'; }
    private function usageBookingExpression(): string { return Schema::hasColumn('customer_service_package_usages', 'booking_id') ? 'u.booking_id' : 'u.used_ref_id'; }
    private function usageStaffExpression(): string { return Schema::hasColumn('customer_service_package_usages', 'staff_id') ? 'u.staff_id' : 'NULL'; }
    private function reservedQtySubquery(): string { return Schema::hasColumn('customer_service_package_usages', 'status') ? "COALESCE((SELECT SUM(ru.used_qty) FROM customer_service_package_usages ru WHERE ru.customer_service_package_id = csp.id AND ru.status = 'reserved'), 0)" : '0'; }
    private function hasPackageTables(): bool { return Schema::hasTable('service_packages') && Schema::hasTable('service_package_items') && Schema::hasTable('customer_service_packages') && Schema::hasTable('customer_service_package_balances') && Schema::hasTable('customer_service_package_usages'); }
    private function hasCsp(string $column): bool { return Schema::hasColumn('customer_service_packages', $column); }
    private function hasBalance(string $column): bool { return Schema::hasColumn('customer_service_package_balances', $column); }
    private function hasUsage(string $column): bool { return Schema::hasColumn('customer_service_package_usages', $column); }
    private function completedUsageStatuses(): array { return ['completed', 'committed', 'consumed']; }
    private function emptySummary(): array { return ['templates'=>['total'=>0,'active'=>0,'inactive'=>0,'missing_redemption_value_count'=>0],'customers'=>['active_holders'=>0,'active_customer_packages'=>0],'balances'=>['remaining_redemptions'=>0,'outstanding_service_value'=>0],'sales'=>['gross_package_sales'=>0,'refund_amount'=>0,'net_package_sales'=>0],'redemptions'=>['redeemed_qty'=>0,'redeemed_value'=>0],'status'=>['expiring_soon'=>0,'exhausted'=>0,'expired'=>0,'cancelled'=>0]]; }
}
