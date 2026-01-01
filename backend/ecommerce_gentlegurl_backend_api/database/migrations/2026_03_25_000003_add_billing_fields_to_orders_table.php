<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('billing_same_as_shipping')->default(true)->after('shipping_country');
            $table->string('billing_name', 255)->nullable()->after('billing_same_as_shipping');
            $table->string('billing_phone', 30)->nullable()->after('billing_name');
            $table->string('billing_address_line1', 255)->nullable()->after('billing_phone');
            $table->string('billing_address_line2', 255)->nullable()->after('billing_address_line1');
            $table->string('billing_city', 100)->nullable()->after('billing_address_line2');
            $table->string('billing_state', 100)->nullable()->after('billing_city');
            $table->string('billing_postcode', 20)->nullable()->after('billing_state');
            $table->string('billing_country', 100)->nullable()->after('billing_postcode');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'billing_same_as_shipping',
                'billing_name',
                'billing_phone',
                'billing_address_line1',
                'billing_address_line2',
                'billing_city',
                'billing_state',
                'billing_postcode',
                'billing_country',
            ]);
        });
    }
};
