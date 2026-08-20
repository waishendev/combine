<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Order;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillBenefitBranchesCommand extends Command
{
    protected $signature = 'benefit-branch:backfill {--dry-run : Report without writing} {--force : Apply the idempotent backfill}';
    protected $description = 'Backfill deterministic Phase 7 benefit transaction Branch attribution';

    public function handle(): int
    {
        if ($this->option('dry-run') === $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::INVALID;
        }

        $report = $this->report();
        $this->table(['Area', 'Assignable/attributable', 'Unresolved/global'], $report);
        if ($this->option('dry-run')) {
            $this->info('Dry-run complete; zero writes performed.');
            return self::SUCCESS;
        }

        DB::transaction(function () {
            DB::statement('UPDATE customer_service_package_usages u SET store_location_id = b.store_location_id FROM bookings b WHERE u.store_location_id IS NULL AND u.booking_id = b.id AND b.store_location_id IS NOT NULL');
            DB::statement('UPDATE points_transactions p SET store_location_id = o.store_location_id FROM orders o WHERE p.store_location_id IS NULL AND p.source_type = ? AND p.source_id = o.id AND o.store_location_id IS NOT NULL', [Order::class]);
            DB::statement('UPDATE loyalty_redemptions r SET store_location_id = o.store_location_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE r.store_location_id IS NULL AND oi.reward_redemption_id = r.id AND o.store_location_id IS NOT NULL');
            DB::statement('UPDATE voucher_usages u SET store_location_id = o.store_location_id FROM orders o WHERE u.store_location_id IS NULL AND u.order_id = o.id AND o.store_location_id IS NOT NULL');
        });

        $this->info('Phase 7 benefit Branch backfill applied. Point balances, package entitlements, and Branch Inventory were untouched.');
        return self::SUCCESS;
    }

    private function report(): array
    {
        $packageAttributable = DB::table('customer_service_package_usages as u')->join('bookings as b', 'b.id', '=', 'u.booking_id')->whereNull('u.store_location_id')->whereNotNull('b.store_location_id')->count();
        $packageNull = DB::table('customer_service_package_usages')->whereNull('store_location_id')->count() - $packageAttributable;
        $pointsAttributable = DB::table('points_transactions as p')->join('orders as o', 'o.id', '=', 'p.source_id')->where('p.source_type', Order::class)->whereNull('p.store_location_id')->whereNotNull('o.store_location_id')->count();
        $pointsGlobal = DB::table('points_transactions')->whereNull('store_location_id')->count() - $pointsAttributable;
        $claimsAttributable = DB::table('loyalty_redemptions as r')->join('order_items as oi', 'oi.reward_redemption_id', '=', 'r.id')->join('orders as o', 'o.id', '=', 'oi.order_id')->whereNull('r.store_location_id')->whereNotNull('o.store_location_id')->distinct()->count('r.id');
        $claimsNull = DB::table('loyalty_redemptions')->whereNull('store_location_id')->count() - $claimsAttributable;

        $voucherAttributable = DB::table('voucher_usages as u')->join('orders as o', 'o.id', '=', 'u.order_id')->whereNull('u.store_location_id')->whereNotNull('o.store_location_id')->count();
        $voucherNull = DB::table('voucher_usages')->whereNull('store_location_id')->count() - $voucherAttributable;

        return [
            ['Voucher definitions', DB::table('vouchers')->count(), 'global; no Branch applicability backfill'],
            ['Redeem Voucher definitions', DB::table('loyalty_rewards')->where('type', 'voucher')->count(), 'global; no Branch applicability backfill'],
            ['Voucher usages', $voucherAttributable, max(0, $voucherNull)],
            ['Package usage', $packageAttributable, max(0, $packageNull)],
            ['Point transactions', $pointsAttributable, max(0, $pointsGlobal).' system/global rows left NULL'],
            ['Product redemption claims', $claimsAttributable, max(0, $claimsNull)],
        ];
    }
}
