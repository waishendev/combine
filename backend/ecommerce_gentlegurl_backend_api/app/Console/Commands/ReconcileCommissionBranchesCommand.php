<?php

namespace App\Console\Commands;

use App\Models\Booking\StaffMonthlySale;
use App\Models\Ecommerce\StoreLocation;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReconcileCommissionBranchesCommand extends Command
{
    protected $signature = 'commission-branch:reconcile {--store-code= : Exact historical operational Branch code} {--dry-run : Audit only} {--force : Rebuild deterministic rows atomically}';
    protected $description = 'Reconcile legacy tiers, snapshots and logs using persisted earning transaction Branches';

    public function __construct(private readonly StaffCommissionService $commissions) { parent::__construct(); }

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code')); $dry = (bool) $this->option('dry-run'); $force = (bool) $this->option('force');
        if ($code === '' || $dry === $force) { $this->error('Provide --store-code and exactly one of --dry-run or --force.'); return self::FAILURE; }
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) { $this->error("Active Branch [{$code}] was not found."); return self::FAILURE; }
        $audit = $this->audit((int) $branch->id);
        $this->report($branch, $audit);
        if ($dry) { $this->info('DRY RUN ONLY — NO DATA CHANGED'); return self::SUCCESS; }
        if ($audit['conflicts']->isNotEmpty()) { $this->error('Reconciliation aborted because conflicts exist.'); return self::FAILURE; }
        try {
            $result = DB::transaction(function () use ($branch) {
                DB::table('staff_commission_tiers')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
                DB::table('staff_monthly_sales')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
                $audit = $this->audit((int) $branch->id);
                if ($audit['conflicts']->isNotEmpty()) throw new RuntimeException('Conflicts appeared after locks were acquired.');
                DB::table('staff_commission_tiers')->whereNull('store_location_id')->update(['store_location_id' => $branch->id, 'updated_at' => now()]);
                $created = 0; $removed = 0;
                foreach ($audit['deterministic'] as $candidate) {
                    $legacy = StaffMonthlySale::query()->findOrFail($candidate['snapshot']->id);
                    foreach ($candidate['branches'] as $branchId) {
                        $row = $this->commissions->recalculateForStaffMonth((int) $legacy->staff_id, (int) $legacy->year, (int) $legacy->month, (string) $legacy->type, true, (int) $branchId);
                        if ($legacy->status === StaffCommissionService::STATUS_FROZEN) $this->commissions->freezeMonthly($row, $legacy->frozen_by);
                        $created++;
                    }
                    if (count($candidate['branches']) === 1) DB::table('staff_commission_logs')->where('staff_monthly_sale_id', $legacy->id)
                        ->whereNull('store_location_id')->update(['store_location_id' => $candidate['branches'][0], 'updated_at' => now()]);
                    DB::table('staff_commission_logs')->where('staff_monthly_sale_id', $legacy->id)->update(['staff_monthly_sale_id' => null]);
                    $legacy->delete(); $removed++;
                }
                return compact('created', 'removed');
            }, 3);
        } catch (\Throwable $e) { $this->error('Reconciliation rolled back: '.$e->getMessage()); return self::FAILURE; }
        $afterSales = (float) StaffMonthlySale::query()->whereNotNull('store_location_id')->sum('total_sales');
        $afterCommission = (float) StaffMonthlySale::query()->whereNotNull('store_location_id')->sum('commission_amount');
        $this->table(['Force result', 'Value'], [['Snapshots rebuilt', $result['created']], ['Legacy snapshots removed', $result['removed']],
            ['Attributed earning total after', number_format($afterSales, 2)], ['Attributed commission total after', number_format($afterCommission, 2)],
            ['Earning delta vs pre-run grand total', number_format($afterSales - $audit['before_sales'], 2)],
            ['Commission delta vs pre-run grand total', number_format($afterCommission - $audit['before_commission'], 2)]]);
        $this->info('Commission Branch reconciliation completed.'); return self::SUCCESS;
    }

    private function audit(int $targetId): array
    {
        $legacyTiers = DB::table('staff_commission_tiers')->whereNull('store_location_id')->get(); $conflicts = collect();
        foreach ($legacyTiers as $tier) if (DB::table('staff_commission_tiers')->where('store_location_id', $targetId)->where('type', $tier->type)->where('min_sales', $tier->min_sales)->exists())
            $conflicts->push("Tier {$tier->type} @ {$tier->min_sales} conflicts in target Branch.");
        $deterministic = collect(); $unresolved = collect(); $split = 0;
        foreach (StaffMonthlySale::query()->whereNull('store_location_id')->get() as $snapshot) {
            $branches = $this->earningBranches($snapshot);
            if ($branches->isEmpty()) { $unresolved->push($snapshot); continue; }
            if ($branches->count() > 1) $split++;
            $deterministic->push(['snapshot' => $snapshot, 'branches' => $branches->all()]);
            foreach ($branches as $branchId) {
                $exists = StaffMonthlySale::query()->where('store_location_id', $branchId)->where('type', $snapshot->type)->where('staff_id', $snapshot->staff_id)
                    ->where('year', $snapshot->year)->where('month', $snapshot->month)->exists();
                if ($exists) $conflicts->push("Snapshot #{$snapshot->id} conflicts with an attributed {$snapshot->type} snapshot for Branch #{$branchId}.");
                if (! DB::table('staff_commission_tiers')->where(function ($q) use ($branchId, $targetId) { $q->where('store_location_id', $branchId); if ($branchId === $targetId) $q->orWhereNull('store_location_id'); })->where('type', $snapshot->type)->exists())
                    $conflicts->push("No {$snapshot->type} tiers exist for Branch #{$branchId} required by snapshot #{$snapshot->id}.");
            }
        }
        return ['legacy_tiers' => $legacyTiers->count(), 'attributed_tiers' => DB::table('staff_commission_tiers')->whereNotNull('store_location_id')->count(),
            'before_sales' => (float) StaffMonthlySale::query()->sum('total_sales'), 'before_commission' => (float) StaffMonthlySale::query()->sum('commission_amount'),
            'legacy_snapshots' => StaffMonthlySale::query()->whereNull('store_location_id')->count(), 'deterministic' => $deterministic, 'split' => $split,
            'unresolved' => $unresolved, 'legacy_logs' => DB::table('staff_commission_logs')->whereNull('store_location_id')->count(), 'conflicts' => $conflicts];
    }

    private function earningBranches(StaffMonthlySale $snapshot)
    {
        $start = Carbon::create($snapshot->year, $snapshot->month, 1)->startOfMonth(); $end = $start->copy()->addMonth();
        if ($snapshot->type === StaffCommissionService::TYPE_BOOKING) {
            return DB::table('bookings')->join('order_items', 'order_items.booking_id', '=', 'bookings.id')->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->leftJoin('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
                ->where('orders.created_at', '>=', $start)->where('orders.created_at', '<', $end)->whereNotNull('bookings.store_location_id')
                ->where(fn ($q) => $q->where('order_item_staff_splits.staff_id', $snapshot->staff_id)->orWhere('bookings.staff_id', $snapshot->staff_id))
                ->distinct()->pluck('bookings.store_location_id')->map(fn ($id) => (int) $id)->values();
        }
        $orders = DB::table('orders')->join('order_items', 'order_items.order_id', '=', 'orders.id')->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('order_item_staff_splits.staff_id', $snapshot->staff_id)->where('orders.created_at', '>=', $start)->where('orders.created_at', '<', $end)->whereNotNull('orders.store_location_id')->pluck('orders.store_location_id');
        $packages = DB::table('orders')->join('customer_service_packages', fn ($j) => $j->on('customer_service_packages.purchased_ref_id', '=', 'orders.id')->where('customer_service_packages.purchased_from', 'POS'))
            ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
            ->where('service_package_staff_splits.staff_id', $snapshot->staff_id)->where('orders.created_at', '>=', $start)->where('orders.created_at', '<', $end)->whereNotNull('orders.store_location_id')->pluck('orders.store_location_id');
        return $orders->concat($packages)->map(fn ($id) => (int) $id)->unique()->values();
    }

    private function report(StoreLocation $branch, array $a): void
    {
        $this->table(['Target Branch', 'ID'], [[$branch->code, $branch->id]]);
        $this->table(['Commission audit', 'Count'], [['Legacy NULL tiers', $a['legacy_tiers']], ['Already attributed tiers', $a['attributed_tiers']],
            ['Legacy NULL snapshots', $a['legacy_snapshots']], ['Safely reconstructable', $a['deterministic']->count()], ['Cross-Branch snapshots to split', $a['split']],
            ['No deterministic source / preserve NULL', $a['unresolved']->count()], ['Legacy NULL logs', $a['legacy_logs']], ['Conflicts/errors', $a['conflicts']->count()]]);
        $this->table(['Pre-run totals', 'Amount'], [['Earnings', number_format($a['before_sales'], 2)], ['Commission', number_format($a['before_commission'], 2)]]);
        foreach ($a['conflicts'] as $message) $this->warn($message);
        $this->line('Projected actions: assign '.$a['legacy_tiers'].' tiers; rebuild '.$a['deterministic']->count().' snapshots; preserve '.$a['unresolved']->count().' Unassigned snapshots.');
    }
}
