<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pos_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->string('name', 100);
            $table->unsignedSmallInteger('default_sort_order');
            $table->boolean('is_system')->default(true);
            $table->timestamps();
        });
        Schema::create('store_location_pos_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->foreignId('pos_payment_method_id')->constrained('pos_payment_methods')->cascadeOnDelete();
            $table->boolean('is_enabled')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['store_location_id', 'pos_payment_method_id'], 'store_pos_payment_method_unique');
        });
        Schema::create('store_location_pos_payment_settings', function (Blueprint $table) {
            $table->foreignId('store_location_id')->primary()->constrained('store_locations')->cascadeOnDelete();
            $table->boolean('allow_split_payment')->default(true);
            $table->boolean('auto_calculate_split')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('pos_payment_methods')->insert([
            ['key' => 'cash', 'name' => 'Cash', 'default_sort_order' => 1, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'qrpay', 'name' => 'QRPay', 'default_sort_order' => 2, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'credit_card', 'name' => 'Credit Card', 'default_sort_order' => 3, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'customer_balance', 'name' => 'Customer Balance', 'default_sort_order' => 4, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('store_location_pos_payment_settings');
        Schema::dropIfExists('store_location_pos_payment_methods');
        Schema::dropIfExists('pos_payment_methods');
    }
};
