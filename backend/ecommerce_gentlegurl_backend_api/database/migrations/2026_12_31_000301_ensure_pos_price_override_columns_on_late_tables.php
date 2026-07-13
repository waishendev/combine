<?php

/**
 * pos_cart_service_items (2026_12_20) and pos_cart_package_items (2026_12_21) are created
 * AFTER the June 2026 price-override migrations. Those earlier migrations skip missing tables
 * and are recorded as "Ran", so columns were never added on fresh installs.
 *
 * Safe to run on any environment: every alter is guarded by Schema::hasColumn().
 */
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_cart_service_items') && ! Schema::hasColumn('pos_cart_service_items', 'price_override_lines')) {
            Schema::table('pos_cart_service_items', function (Blueprint $table) {
                $table->json('price_override_lines')->nullable();
            });
        }

        if (Schema::hasTable('pos_cart_package_items')) {
            Schema::table('pos_cart_package_items', function (Blueprint $table) {
                if (! Schema::hasColumn('pos_cart_package_items', 'price_override_line_total')) {
                    $table->decimal('price_override_line_total', 12, 2)->nullable();
                }
                if (! Schema::hasColumn('pos_cart_package_items', 'price_override_snapshot')) {
                    $table->json('price_override_snapshot')->nullable();
                }
            });
        }

        if (Schema::hasTable('pos_cart_items') && ! Schema::hasColumn('pos_cart_items', 'price_override_snapshot')) {
            Schema::table('pos_cart_items', function (Blueprint $table) {
                $table->json('price_override_snapshot')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('pos_cart_service_items') && Schema::hasColumn('pos_cart_service_items', 'price_override_lines')) {
            Schema::table('pos_cart_service_items', function (Blueprint $table) {
                $table->dropColumn('price_override_lines');
            });
        }

        if (Schema::hasTable('pos_cart_package_items')) {
            Schema::table('pos_cart_package_items', function (Blueprint $table) {
                if (Schema::hasColumn('pos_cart_package_items', 'price_override_snapshot')) {
                    $table->dropColumn('price_override_snapshot');
                }
                if (Schema::hasColumn('pos_cart_package_items', 'price_override_line_total')) {
                    $table->dropColumn('price_override_line_total');
                }
            });
        }

        if (Schema::hasTable('pos_cart_items') && Schema::hasColumn('pos_cart_items', 'price_override_snapshot')) {
            Schema::table('pos_cart_items', function (Blueprint $table) {
                $table->dropColumn('price_override_snapshot');
            });
        }
    }
};
