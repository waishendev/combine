<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('shipping_courier', 100)
                ->nullable()
                ->after('shipping_country');
            $table->string('shipping_tracking_no', 100)
                ->nullable()
                ->after('shipping_courier');
            $table->timestamp('shipped_at')
                ->nullable()
                ->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['shipping_courier', 'shipping_tracking_no', 'shipped_at']);
        });
    }
};
