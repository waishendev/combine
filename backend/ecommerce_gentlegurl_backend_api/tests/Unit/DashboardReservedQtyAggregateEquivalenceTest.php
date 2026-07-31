<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Phase B: reserved_qty leftJoinSub + MAX must match the legacy correlated subquery.
 */
class DashboardReservedQtyAggregateEquivalenceTest extends TestCase
{
    public function test_reserved_aggregate_join_matches_correlated_subquery(): void
    {
        if (! Schema::hasTable('customer_service_package_usages')
            || ! Schema::hasColumn('customer_service_package_usages', 'status')
            || ! Schema::hasTable('customer_service_packages')) {
            $this->markTestSkipped('Package usage tables not present.');
        }

        $legacy = DB::table('customer_service_packages as csp')
            ->selectRaw("csp.id, COALESCE((SELECT SUM(ru.used_qty) FROM customer_service_package_usages ru WHERE ru.customer_service_package_id = csp.id AND ru.status = 'reserved'), 0) as reserved_qty")
            ->orderBy('csp.id')
            ->get()
            ->map(fn ($r) => [(int) $r->id, (int) $r->reserved_qty])
            ->all();

        $optimized = DB::table('customer_service_packages as csp')
            ->leftJoinSub(
                DB::table('customer_service_package_usages')
                    ->selectRaw('customer_service_package_id, SUM(used_qty) as reserved_qty')
                    ->where('status', 'reserved')
                    ->groupBy('customer_service_package_id'),
                'reserved_agg',
                'reserved_agg.customer_service_package_id',
                '=',
                'csp.id'
            )
            ->selectRaw('csp.id, COALESCE(reserved_agg.reserved_qty, 0) as reserved_qty')
            ->orderBy('csp.id')
            ->get()
            ->map(fn ($r) => [(int) $r->id, (int) $r->reserved_qty])
            ->all();

        $this->assertSame($legacy, $optimized);
    }

    public function test_reserved_qty_with_balance_join_uses_max_not_sum(): void
    {
        if (! Schema::hasTable('customer_service_package_balances')
            || ! Schema::hasTable('customer_service_package_usages')
            || ! Schema::hasColumn('customer_service_package_usages', 'status')) {
            $this->markTestSkipped('Package balance/usage tables not present.');
        }

        // Simulate list query shape: balances multiply rows; reserved must use MAX not SUM.
        $withMax = DB::table('customer_service_packages as csp')
            ->leftJoin('customer_service_package_balances as b', 'b.customer_service_package_id', '=', 'csp.id')
            ->leftJoinSub(
                DB::table('customer_service_package_usages')
                    ->selectRaw('customer_service_package_id, SUM(used_qty) as reserved_qty')
                    ->where('status', 'reserved')
                    ->groupBy('customer_service_package_id'),
                'reserved_agg',
                'reserved_agg.customer_service_package_id',
                '=',
                'csp.id'
            )
            ->groupBy('csp.id')
            ->selectRaw('csp.id, COALESCE(MAX(reserved_agg.reserved_qty), 0) as reserved_qty')
            ->orderBy('csp.id')
            ->get()
            ->map(fn ($r) => [(int) $r->id, (int) $r->reserved_qty])
            ->all();

        $legacy = DB::table('customer_service_packages as csp')
            ->selectRaw("csp.id, COALESCE((SELECT SUM(ru.used_qty) FROM customer_service_package_usages ru WHERE ru.customer_service_package_id = csp.id AND ru.status = 'reserved'), 0) as reserved_qty")
            ->orderBy('csp.id')
            ->get()
            ->map(fn ($r) => [(int) $r->id, (int) $r->reserved_qty])
            ->all();

        $this->assertSame($legacy, $withMax);
    }
}
