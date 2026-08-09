<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillBenefitBranchesCommand extends Command
{
    protected $signature = 'benefit-branch:backfill {--store-code= : Operator-approved Branch code for legacy definitions} {--dry-run : Report without writing} {--force : Apply the idempotent backfill}';
    protected $description = 'Backfill deterministic Phase 7 benefit Branch assignments and transaction attribution';

    public function handle(): int
    {
        if ($this->option('dry-run') === $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::INVALID;
        }

        $code = trim((string) $this->option('store-code'));
        $branch = StoreLocation::query()->where('code', $code)->first();
        if (!$branch || !$branch->is_active) {
            $this->error('The supplied store code does not identify an active Branch. No writes performed.');
            return self::FAILURE;
        }

        $report = $this->report((int) $branch->id);
        $this->table(['Area', 'Assignable/attributable', 'Unresolved/global'], $report);
        if ($this->option('dry-run')) {
            $this->info('Dry-run complete; zero writes performed.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($branch) {
            DB::table('vouchers')->orderBy('id')->select('id')->chunkById(500, function ($rows) use ($branch) {
                DB::table('voucher_store_location')->insertOrIgnore($rows->map(fn ($row) => [
                    'voucher_id' => $row->id, 'store_location_id' => $branch->id,
                    'created_at' => now(), 'updated_at' => now(),
                ])->all());
            });

            DB::table('loyalty_rewards')->where('type', 'voucher')->orderBy('id')->select('id')->chunkById(500, function ($rows) use ($branch) {
                DB::table('loyalty_reward_store_location')->insertOrIgnore($rows->map(fn ($row) => [
                    'loyalty_reward_id' => $row->id, 'store_location_id' => $branch->id,
                    'created_at' => now(), 'updated_at' => now(),
                ])->all());
            });

            DB::statement('UPDATE customer_service_package_usages u SET store_location_id = b.store_location_id FROM bookings b WHERE u.store_location_id IS NULL AND u.booking_id = b.id AND b.store_location_id IS NOT NULL');
            DB::statement('UPDATE points_transactions p SET store_location_id = o.store_location_id FROM orders o WHERE p.store_location_id IS NULL AND p.source_type = ? AND p.source_id = o.id AND o.store_location_id IS NOT NULL', [Order::class]);
            DB::statement('UPDATE loyalty_redemptions r SET store_location_id = o.store_location_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE r.store_location_id IS NULL AND oi.reward_redemption_id = r.id AND o.store_location_id IS NOT NULL');
            DB::statement('UPDATE voucher_usages u SET store_location_id = o.store_location_id FROM orders o WHERE u.store_location_id IS NULL AND u.order_id = o.id AND o.store_location_id IS NOT NULL');
        });

        $this->info('Phase 7 benefit Branch backfill applied. Point balances, package entitlements, and Branch Inventory were untouched.');
        return self::SUCCESS;
    }

    private function report(int $branchId): array
    {
        $voucherUnassigned = DB::table('vouchers as v')->whereNotExists(fn ($q) => $q->selectRaw('1')->from('voucher_store_location as x')->whereColumn('x.voucher_id', 'v.id'))->count();
        $rewardUnassigned = DB::table('loyalty_rewards as r')->where('type', 'voucher')->whereNotExists(fn ($q) => $q->selectRaw('1')->from('loyalty_reward_store_location as x')->whereColumn('x.loyalty_reward_id', 'r.id'))->count();
        $packageAttributable = DB::table('customer_service_package_usages as u')->join('bookings as b', 'b.id', '=', 'u.booking_id')->whereNull('u.store_location_id')->whereNotNull('b.store_location_id')->count();
        $packageNull = DB::table('customer_service_package_usages')->whereNull('store_location_id')->count() - $packageAttributable;
        $pointsAttributable = DB::table('points_transactions as p')->join('orders as o', 'o.id', '=', 'p.source_id')->where('p.source_type', Order::class)->whereNull('p.store_location_id')->whereNotNull('o.store_location_id')->count();
        $pointsGlobal = DB::table('points_transactions')->whereNull('store_location_id')->count() - $pointsAttributable;
        $claimsAttributable = DB::table('loyalty_redemptions as r')->join('order_items as oi', 'oi.reward_redemption_id', '=', 'r.id')->join('orders as o', 'o.id', '=', 'oi.order_id')->whereNull('r.store_location_id')->whereNotNull('o.store_location_id')->distinct()->count('r.id');
        $claimsNull = DB::table('loyalty_redemptions')->whereNull('store_location_id')->count() - $claimsAttributable;

        return [
            ['Voucher definitions', $voucherUnassigned, DB::table('voucher_store_location')->count().' existing assignments preserved'],
            ['Redeem Voucher definitions', $rewardUnassigned, DB::table('loyalty_reward_store_location')->count().' existing assignments preserved'],
            ['Package usage', $packageAttributable, max(0, $packageNull)],
            ['Point transactions', $pointsAttributable, max(0, $pointsGlobal).' system/global rows left NULL'],
            ['Product redemption claims', $claimsAttributable, max(0, $claimsNull)],
        ];
    }
}
