<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CRM orders + shop returns query enhancement — P0 indexes.
 * Enhancement id: orders-shop-returns-query-v1
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (Schema::hasTable('orders')) {
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_store_created_at_idx ON orders (store_location_id, created_at DESC) WHERE created_by_user_id IS NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_status_created_at_idx ON orders (status, created_at DESC) WHERE created_by_user_id IS NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS orders_created_by_user_id_idx ON orders (created_by_user_id) WHERE created_by_user_id IS NOT NULL');
        }

        if (Schema::hasTable('return_requests')) {
            DB::statement('CREATE INDEX IF NOT EXISTS return_requests_customer_created_at_idx ON return_requests (customer_id, created_at DESC)');
            DB::statement('CREATE INDEX IF NOT EXISTS return_requests_order_id_idx ON return_requests (order_id)');
        }

        if (Schema::hasTable('return_request_items')) {
            DB::statement('CREATE INDEX IF NOT EXISTS return_request_items_return_request_id_idx ON return_request_items (return_request_id)');
        }

        if (Schema::hasTable('booking_refunds') && Schema::hasColumn('booking_refunds', 'return_request_id')) {
            DB::statement('CREATE INDEX IF NOT EXISTS booking_refunds_return_request_id_idx ON booking_refunds (return_request_id) WHERE return_request_id IS NOT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS orders_shop_store_created_at_idx');
        DB::statement('DROP INDEX IF EXISTS orders_shop_status_created_at_idx');
        DB::statement('DROP INDEX IF EXISTS orders_created_by_user_id_idx');
        DB::statement('DROP INDEX IF EXISTS return_requests_customer_created_at_idx');
        DB::statement('DROP INDEX IF EXISTS return_requests_order_id_idx');
        DB::statement('DROP INDEX IF EXISTS return_request_items_return_request_id_idx');
        DB::statement('DROP INDEX IF EXISTS booking_refunds_return_request_id_idx');
    }
};
