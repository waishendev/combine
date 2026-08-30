<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * orders-shop-returns-query-v2 — booking flag + trigram order_number search.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'is_booking_checkout')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->boolean('is_booking_checkout')->default(false)->after('created_by_user_id');
            });
        }

        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'is_booking_checkout')) {
            $driver = Schema::getConnection()->getDriverName();

            if ($driver === 'pgsql') {
                DB::statement(<<<'SQL'
UPDATE orders
SET is_booking_checkout = true
WHERE is_booking_checkout = false
  AND (
    notes ILIKE '%Booking cart checkout%'
    OR EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = orders.id
        AND oi.line_type IN (
          'booking_deposit', 'booking_addon', 'booking_settlement',
          'booking_product', 'service_package'
        )
    )
    OR EXISTS (
      SELECT 1 FROM order_service_items osi
      WHERE osi.order_id = orders.id
    )
  )
SQL);
                DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
                if (Schema::hasColumn('orders', 'created_by_user_id')) {
                    DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_booking_checkout_created_at_idx ON orders (is_booking_checkout, created_at DESC) WHERE created_by_user_id IS NULL');
                    DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_order_number_trgm_idx ON orders USING gin (order_number gin_trgm_ops) WHERE created_by_user_id IS NULL');
                }
            } else {
                DB::table('orders')
                    ->where('is_booking_checkout', false)
                    ->where(function ($q) {
                        $q->where('notes', 'like', '%Booking cart checkout%')
                            ->orWhereExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('order_items')
                                    ->whereColumn('order_items.order_id', 'orders.id')
                                    ->whereIn('line_type', [
                                        'booking_deposit',
                                        'booking_addon',
                                        'booking_settlement',
                                        'booking_product',
                                        'service_package',
                                    ]);
                            })
                            ->orWhereExists(function ($sub) {
                                $sub->selectRaw('1')
                                    ->from('order_service_items')
                                    ->whereColumn('order_service_items.order_id', 'orders.id');
                            });
                    })
                    ->update(['is_booking_checkout' => true]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS orders_shop_booking_checkout_created_at_idx');
            DB::statement('DROP INDEX IF EXISTS orders_shop_order_number_trgm_idx');
        }

        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'is_booking_checkout')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('is_booking_checkout');
            });
        }
    }
};
