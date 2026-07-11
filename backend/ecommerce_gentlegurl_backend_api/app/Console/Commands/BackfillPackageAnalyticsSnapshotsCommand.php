<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackfillPackageAnalyticsSnapshotsCommand extends Command
{
    protected $signature = 'analytics:backfill-package-snapshots {--dry-run : Preview missing snapshots} {--force : Write nullable snapshot fields from current source records}';
    protected $description = 'Backfill package analytics snapshots safely after previewing proposed values.';

    public function handle(): int
    {
        if (! Schema::hasTable('customer_service_packages')) {
            $this->warn('Package tables are not installed.');
            return self::SUCCESS;
        }

        $missingPackages = Schema::hasColumn('customer_service_packages', 'package_name_snapshot')
            ? DB::table('customer_service_packages')->whereNull('package_name_snapshot')->count()
            : 0;
        $missingBalances = Schema::hasColumn('customer_service_package_balances', 'redemption_value_snapshot')
            ? DB::table('customer_service_package_balances')->whereNull('redemption_value_snapshot')->count()
            : 0;
        $missingUsages = Schema::hasColumn('customer_service_package_usages', 'redemption_value_snapshot')
            ? DB::table('customer_service_package_usages')->whereNull('redemption_value_snapshot')->count()
            : 0;

        $this->line("customer packages missing purchase snapshots: {$missingPackages}");
        $this->line("balances missing redemption snapshots: {$missingBalances}");
        $this->line("usages missing redemption snapshots: {$missingUsages}");

        if ($this->option('dry-run') || ! $this->option('force')) {
            $this->info('No database changes made. Re-run with --force to backfill from current package templates/items.');
            return self::SUCCESS;
        }

        DB::transaction(function () {
            if (Schema::hasColumn('customer_service_packages', 'package_name_snapshot')) {
                DB::table('customer_service_packages as csp')
                    ->join('service_packages as sp', 'sp.id', '=', 'csp.service_package_id')
                    ->whereNull('csp.package_name_snapshot')
                    ->update(['package_name_snapshot' => DB::raw('sp.name'), 'selling_price_snapshot' => DB::raw('sp.selling_price')]);
            }
            if (Schema::hasColumn('customer_service_package_balances', 'redemption_value_snapshot') && Schema::hasColumn('service_package_items', 'redemption_value')) {
                DB::table('customer_service_package_balances as b')
                    ->join('customer_service_packages as csp', 'csp.id', '=', 'b.customer_service_package_id')
                    ->join('service_package_items as spi', function ($join) { $join->on('spi.service_package_id', '=', 'csp.service_package_id')->on('spi.booking_service_id', '=', 'b.booking_service_id'); })
                    ->leftJoin('booking_services as bs', 'bs.id', '=', 'b.booking_service_id')
                    ->whereNull('b.redemption_value_snapshot')
                    ->update(['redemption_value_snapshot' => DB::raw('spi.redemption_value'), 'service_name_snapshot' => DB::raw('bs.name')]);
            }
            if (Schema::hasColumn('customer_service_package_usages', 'redemption_value_snapshot') && Schema::hasColumn('customer_service_package_balances', 'redemption_value_snapshot')) {
                DB::table('customer_service_package_usages as u')
                    ->join('customer_service_package_balances as b', function ($join) { $join->on('b.customer_service_package_id', '=', 'u.customer_service_package_id')->on('b.booking_service_id', '=', 'u.booking_service_id'); })
                    ->leftJoin('booking_services as bs', 'bs.id', '=', 'u.booking_service_id')
                    ->whereNull('u.redemption_value_snapshot')
                    ->update(['redemption_value_snapshot' => DB::raw('b.redemption_value_snapshot'), 'service_name_snapshot' => DB::raw('bs.name')]);
            }
        });

        $this->info('Package analytics snapshots backfilled.');
        return self::SUCCESS;
    }
}
