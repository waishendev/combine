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

        $activeScope = fn ($q) => $q->where('csp.status', 'active')->where(fn ($d) => $d->whereNull('csp.expires_at')->orWhere('csp.expires_at', '>=', now()));
        $balanceValue = $this->balanceValueExpression();
        $usageValue = $this->usageValueExpression();
        $expiringDays = max(1, (int) $request->query('expiring_days', 30));

        $templates = DB::table('service_packages')->selectRaw('COUNT(*) total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) active, SUM(CASE WHEN is_active THEN 0 ELSE 1 END) inactive')->first();
        $missingRedemption = Schema::hasColumn('service_package_items', 'redemption_value')
            ? (int) DB::table('service_package_items')->whereNull('redemption_value')->count()
            : (int) DB::table('service_package_items')->count();

        $activePackagesQuery = DB::table('customer_service_packages as csp')->where($activeScope);
        $activePackageIdsWithRemaining = DB::table('customer_service_package_balances')->select('customer_service_package_id')->where('remaining_qty', '>', 0);

        $activeHolders = (clone $activePackagesQuery)->whereIn('csp.id', $activePackageIdsWithRemaining)->distinct('csp.customer_id')->count('csp.customer_id');
        $activeCustomerPackages = (clone $activePackagesQuery)->whereIn('csp.id', $activePackageIdsWithRemaining)->count();

        $balances = DB::table('customer_service_package_balances as b')
            ->join('customer_service_packages as csp', 'csp.id', '=', 'b.customer_service_package_id')
            ->where($activeScope)
            ->selectRaw("SUM(b.remaining_qty) remaining_redemptions, SUM(b.remaining_qty * {$balanceValue}) outstanding_service_value")
            ->first();

        $sales = $this->packageSalesQuery()->selectRaw('SUM(gross_amount) gross, SUM(refund_amount) refunds, SUM(net_amount) net')->first();

        $redemptions = DB::table('customer_service_package_usages as u');
        if (Schema::hasColumn('customer_service_package_usages', 'status')) {
            $redemptions->whereIn('u.status', $this->completedUsageStatuses());
        }
        $redemptions = $redemptions->selectRaw("SUM(u.used_qty) redeemed_qty, SUM(u.used_qty * {$usageValue}) redeemed_value")
            ->first();

        $status = DB::table('customer_service_packages as csp')->selectRaw(
            "SUM(CASE WHEN status = 'active' AND expires_at BETWEEN ? AND ? THEN 1 ELSE 0 END) expiring_soon, SUM(CASE WHEN status = 'exhausted' THEN 1 ELSE 0 END) exhausted, SUM(CASE WHEN status = 'expired' OR (status = 'active' AND expires_at < ?) THEN 1 ELSE 0 END) expired, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) cancelled",
            [now(), now()->addDays($expiringDays), now()]
        )->first();

        return response()->json([
            'templates' => ['total' => (int) ($templates->total ?? 0), 'active' => (int) ($templates->active ?? 0), 'inactive' => (int) ($templates->inactive ?? 0), 'missing_redemption_value_count' => $missingRedemption],
            'customers' => ['active_holders' => (int) $activeHolders, 'active_customer_packages' => (int) $activeCustomerPackages],
            'balances' => ['remaining_redemptions' => (int) ($balances->remaining_redemptions ?? 0), 'outstanding_service_value' => round((float) ($balances->outstanding_service_value ?? 0), 2)],
            'sales' => ['gross_package_sales' => round((float) ($sales->gross ?? 0), 2), 'refund_amount' => round((float) ($sales->refunds ?? 0), 2), 'net_package_sales' => round((float) ($sales->net ?? 0), 2)],
            'redemptions' => ['redeemed_qty' => (int) ($redemptions->redeemed_qty ?? 0), 'redeemed_value' => round((float) ($redemptions->redeemed_value ?? 0), 2)],
            'status' => ['expiring_soon' => (int) ($status->expiring_soon ?? 0), 'exhausted' => (int) ($status->exhausted ?? 0), 'expired' => (int) ($status->expired ?? 0), 'cancelled' => (int) ($status->cancelled ?? 0)],
        ]);
    }

    public function customerPackages(Request $request)
    {
        if (! $this->hasPackageTables()) return response()->json(['data' => []]);
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');
        $value = $this->balanceValueExpression();
        $packageName = $this->cspColumn('package_name_snapshot', 'sp.name');
        $purchaseAmount = $this->cspColumn('purchase_amount_snapshot', 'sp.selling_price');

        $query = DB::table('customer_service_packages as csp')
            ->join('customers as c', 'c.id', '=', 'csp.customer_id')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->leftJoin('customer_service_package_balances as b', 'b.customer_service_package_id', '=', 'csp.id')
            ->selectRaw("csp.id, c.name customer, {$packageName} package, csp.purchased_from, csp.created_at purchase_date, csp.started_at, csp.expires_at, csp.status, {$purchaseAmount} purchase_amount, SUM(b.total_qty) total_qty, SUM(b.used_qty) used_qty, SUM(b.remaining_qty) remaining_qty, SUM(b.remaining_qty * {$value}) remaining_service_value, SUM(CASE WHEN {$value} = 0 THEN 1 ELSE 0 END) missing_values")
            ->groupBy('csp.id', 'c.name', 'sp.name', 'sp.selling_price', 'csp.purchased_from', 'csp.created_at', 'csp.started_at', 'csp.expires_at', 'csp.status');
        if ($search !== '') $query->where(fn ($q) => $q->where('c.name', 'like', "%{$search}%")->orWhere('sp.name', 'like', "%{$search}%"));
        if ($status) $query->where('csp.status', $status);
        return response()->json($query->orderByDesc('remaining_service_value')->paginate($perPage));
    }

    public function sales(Request $request)
    {
        return response()->json($this->packageSalesQuery()->orderByDesc('purchased_at')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function redemptions(Request $request)
    {
        if (! $this->hasPackageTables()) return response()->json(['data' => []]);
        $value = $this->usageValueExpression();
        $serviceName = $this->usageColumn('service_name_snapshot', 'bs.name');
        $packageName = $this->cspColumn('package_name_snapshot', 'sp.name');
        $usageDate = Schema::hasColumn('customer_service_package_usages', 'consumed_at') ? 'COALESCE(u.consumed_at, u.created_at)' : 'u.created_at';
        $usageStatus = Schema::hasColumn('customer_service_package_usages', 'status') ? 'u.status' : "'completed'";
        $query = DB::table('customer_service_package_usages as u')
            ->join('customers as c', 'c.id', '=', 'u.customer_id')
            ->join('customer_service_packages as csp', 'csp.id', '=', 'u.customer_service_package_id')
            ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
            ->leftJoin('booking_services as bs', 'bs.id', '=', 'u.booking_service_id')
            ->when(Schema::hasColumn('customer_service_package_usages', 'status'), fn ($q) => $q->whereIn('u.status', $this->completedUsageStatuses()))
            ->selectRaw("u.id, {$usageDate} usage_date, u.booking_id booking_no, c.name customer, {$packageName} package, {$serviceName} service, u.used_qty, {$value} redemption_value_per_unit, u.used_qty * {$value} total_redemption_value, u.used_from source, {$usageStatus} status");
        return response()->json($query->orderByDesc('usage_date')->paginate(min(max((int) $request->query('per_page', 10), 1), 50)));
    }

    public function customerPackageDetail(int $id)
    {
        if (! $this->hasPackageTables()) abort(404);
        $row = DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->where('csp.id', $id)->select('csp.*', 'c.name as customer', 'sp.name as current_package_name')->first();
        if (! $row) abort(404);
        $balances = DB::table('customer_service_package_balances as b')->leftJoin('booking_services as bs', 'bs.id', '=', 'b.booking_service_id')->where('b.customer_service_package_id', $id)->selectRaw('b.*, COALESCE(b.service_name_snapshot, bs.name) service_name')->get();
        $usages = DB::table('customer_service_package_usages as u')->leftJoin('booking_services as bs', 'bs.id', '=', 'u.booking_service_id')->where('u.customer_service_package_id', $id)->selectRaw('u.*, COALESCE(u.service_name_snapshot, bs.name) service_name')->orderByDesc('u.created_at')->get();
        return response()->json(['package' => $row, 'balances' => $balances, 'usages' => $usages]);
    }

    private function packageSalesQuery()
    {
        if (! Schema::hasTable('order_items') || ! Schema::hasColumn('order_items', 'service_package_id')) {
            $reference = Schema::hasColumn('customer_service_packages', 'purchase_reference_snapshot') ? "COALESCE(csp.purchase_reference_snapshot, CONCAT('CSP-', csp.id))" : "CONCAT('CSP-', csp.id)";
            $package = $this->cspColumn('package_name_snapshot', 'sp.name');
            $purchase = $this->cspColumn('purchase_amount_snapshot', '0');
            $refund = $this->cspColumn('refunded_amount_snapshot', '0');
            return DB::query()->fromSub(DB::table('customer_service_packages as csp')->join('customers as c', 'c.id', '=', 'csp.customer_id')->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')->selectRaw("csp.id, {$reference} reference_no, c.name customer, {$package} package, csp.purchased_from channel, NULL payment_method, csp.purchased_from, {$purchase} gross_amount, 0 discount, {$refund} refund_amount, {$purchase} - {$refund} net_amount, csp.status, csp.created_at purchased_at"), 'sales');
        }
        $lineTotal = Schema::hasColumn('order_items', 'effective_line_total') ? 'oi.effective_line_total' : (Schema::hasColumn('order_items', 'line_total_snapshot') ? 'oi.line_total_snapshot' : 'oi.line_total');
        $refund = Schema::hasColumn('orders', 'refund_total') ? 'COALESCE(o.refund_total, 0)' : '0';
        return DB::query()->fromSub(DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')->where('oi.is_package', true)->whereNotNull('oi.service_package_id')->whereIn('o.payment_status', ['paid','completed','refunded','partially_refunded'])->whereNotIn('o.status', ['cancelled','voided'])->selectRaw("o.order_number reference_no, c.name customer, COALESCE(oi.product_name_snapshot, sp.name) package, COALESCE(o.payment_provider, o.payment_method, 'Unknown') channel, o.payment_method, 'ORDER' purchased_from, {$lineTotal} gross_amount, COALESCE(o.discount_total, 0) discount, {$refund} refund_amount, GREATEST({$lineTotal} - {$refund}, 0) net_amount, o.status, COALESCE(o.paid_at, o.created_at) purchased_at"), 'sales');
    }

    private function hasPackageTables(): bool { return Schema::hasTable('service_packages') && Schema::hasTable('customer_service_packages') && Schema::hasTable('customer_service_package_balances') && Schema::hasTable('customer_service_package_usages'); }
    private function balanceValueExpression(): string { return Schema::hasColumn('customer_service_package_balances', 'redemption_value_snapshot') ? 'COALESCE(b.redemption_value_snapshot, 0)' : '0'; }
    private function usageValueExpression(): string { return Schema::hasColumn('customer_service_package_usages', 'redemption_value_snapshot') ? 'COALESCE(u.redemption_value_snapshot, 0)' : '0'; }
    private function cspColumn(string $column, string $fallback): string { return Schema::hasColumn('customer_service_packages', $column) ? "COALESCE(csp.{$column}, {$fallback})" : $fallback; }
    private function usageColumn(string $column, string $fallback): string { return Schema::hasColumn('customer_service_package_usages', $column) ? "COALESCE(u.{$column}, {$fallback})" : $fallback; }
    private function completedUsageStatuses(): array { return ['completed', 'committed', 'consumed']; }
    private function emptySummary(): array { return ['templates'=>['total'=>0,'active'=>0,'inactive'=>0,'missing_redemption_value_count'=>0],'customers'=>['active_holders'=>0,'active_customer_packages'=>0],'balances'=>['remaining_redemptions'=>0,'outstanding_service_value'=>0],'sales'=>['gross_package_sales'=>0,'refund_amount'=>0,'net_package_sales'=>0],'redemptions'=>['redeemed_qty'=>0,'redeemed_value'=>0],'status'=>['expiring_soon'=>0,'exhausted'=>0,'expired'=>0,'cancelled'=>0]]; }
}
