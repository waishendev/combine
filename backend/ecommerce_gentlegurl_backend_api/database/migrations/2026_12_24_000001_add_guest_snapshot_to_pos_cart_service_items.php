<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Must run after 2026_12_20_000004 (creates pos_cart_service_items) and
 * 2026_12_23_000006 (adds customer_id) — do not use an earlier date prefix than those.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pos_cart_service_items')) {
            return;
        }

        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cart_service_items', 'guest_name')) {
                $table->string('guest_name')->nullable()->after('customer_id');
            }
            if (! Schema::hasColumn('pos_cart_service_items', 'guest_phone')) {
                $table->string('guest_phone', 32)->nullable()->after('guest_name');
            }
            if (! Schema::hasColumn('pos_cart_service_items', 'guest_email')) {
                $table->string('guest_email', 255)->nullable()->after('guest_phone');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('pos_cart_service_items')) {
            return;
        }

        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('pos_cart_service_items', 'guest_name')) {
                $cols[] = 'guest_name';
            }
            if (Schema::hasColumn('pos_cart_service_items', 'guest_phone')) {
                $cols[] = 'guest_phone';
            }
            if (Schema::hasColumn('pos_cart_service_items', 'guest_email')) {
                $cols[] = 'guest_email';
            }
            if ($cols !== []) {
                $table->dropColumn($cols);
            }
        });
    }
};
