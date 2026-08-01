<?php

namespace Tests\Unit;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Confirms the POS checkout index migration is additive: creates expected indexes
 * without changing query result rows for the hot lookup shapes.
 */
class PosCheckoutQueryIndexesMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('customer_service_package_usages');
        Schema::dropIfExists('orders');

        Schema::create('customer_service_package_usages', function (Blueprint $table) {
            $table->id();
            $table->string('used_from')->nullable();
            $table->unsignedBigInteger('used_ref_id')->nullable();
            $table->string('status');
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->decimal('grand_total', 12, 2)->default(0);
            $table->string('status')->nullable();
            $table->timestamps();
        });

        DB::table('customer_service_package_usages')->insert([
            [
                'used_from' => 'POS',
                'used_ref_id' => 11,
                'status' => 'reserved',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'used_from' => 'POS',
                'used_ref_id' => 12,
                'status' => 'released',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'used_from' => 'BOOKING',
                'used_ref_id' => 11,
                'status' => 'consumed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('orders')->insert([
            [
                'customer_id' => 5,
                'grand_total' => 10.5,
                'status' => 'completed',
                'created_at' => '2026-07-01 10:00:00',
                'updated_at' => '2026-07-01 10:00:00',
            ],
            [
                'customer_id' => 5,
                'grand_total' => 20,
                'status' => 'completed',
                'created_at' => '2026-07-02 10:00:00',
                'updated_at' => '2026-07-02 10:00:00',
            ],
            [
                'customer_id' => 9,
                'grand_total' => 99,
                'status' => 'completed',
                'created_at' => '2026-07-03 10:00:00',
                'updated_at' => '2026-07-03 10:00:00',
            ],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('customer_service_package_usages');
        Schema::dropIfExists('orders');
        parent::tearDown();
    }

    public function test_migration_adds_indexes_without_changing_lookup_results(): void
    {
        $usageBefore = DB::table('customer_service_package_usages')
            ->where('used_from', 'POS')
            ->where('used_ref_id', 11)
            ->whereIn('status', ['reserved', 'consumed'])
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $ordersBefore = DB::table('orders')
            ->where('customer_id', 5)
            ->orderByDesc('created_at')
            ->get(['id', 'grand_total', 'created_at'])
            ->map(fn ($row) => (array) $row)
            ->all();

        $aggBefore = (array) DB::table('orders')
            ->where('customer_id', 5)
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(grand_total),0) as s, MAX(created_at) as m')
            ->first();

        $migration = require database_path('migrations/2026_08_01_000300_add_pos_checkout_query_indexes.php');
        $migration->up();

        $this->assertTrue($this->sqliteIndexExists('customer_service_package_usages', 'csp_usages_used_from_used_ref_id_index'));
        $this->assertTrue($this->sqliteIndexExists('orders', 'orders_customer_id_created_at_index'));

        $usageAfter = DB::table('customer_service_package_usages')
            ->where('used_from', 'POS')
            ->where('used_ref_id', 11)
            ->whereIn('status', ['reserved', 'consumed'])
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $ordersAfter = DB::table('orders')
            ->where('customer_id', 5)
            ->orderByDesc('created_at')
            ->get(['id', 'grand_total', 'created_at'])
            ->map(fn ($row) => (array) $row)
            ->all();

        $aggAfter = (array) DB::table('orders')
            ->where('customer_id', 5)
            ->selectRaw('COUNT(*) as c, COALESCE(SUM(grand_total),0) as s, MAX(created_at) as m')
            ->first();

        $this->assertSame($usageBefore, $usageAfter);
        $this->assertSame($ordersBefore, $ordersAfter);
        $this->assertSame((int) $aggBefore['c'], (int) $aggAfter['c']);
        $this->assertEquals((float) $aggBefore['s'], (float) $aggAfter['s']);
        $this->assertSame((string) $aggBefore['m'], (string) $aggAfter['m']);

        // Idempotent up()
        $migration->up();
        $this->assertTrue($this->sqliteIndexExists('customer_service_package_usages', 'csp_usages_used_from_used_ref_id_index'));
        $this->assertTrue($this->sqliteIndexExists('orders', 'orders_customer_id_created_at_index'));

        $migration->down();
        $this->assertFalse($this->sqliteIndexExists('customer_service_package_usages', 'csp_usages_used_from_used_ref_id_index'));
        $this->assertFalse($this->sqliteIndexExists('orders', 'orders_customer_id_created_at_index'));
    }

    private function sqliteIndexExists(string $table, string $indexName): bool
    {
        $rows = DB::select('PRAGMA index_list('.$table.')');
        foreach ($rows as $row) {
            $name = is_array($row) ? ($row['name'] ?? null) : ($row->name ?? null);
            if ($name === $indexName) {
                return true;
            }
        }

        return false;
    }
}
