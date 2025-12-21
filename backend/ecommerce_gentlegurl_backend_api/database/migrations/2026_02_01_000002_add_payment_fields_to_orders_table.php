<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_provider', 50)->nullable()->after('payment_method');
            $table->string('payment_reference', 100)->nullable()->after('payment_provider');
            $table->string('payment_url')->nullable()->after('payment_reference');
            $table->json('payment_meta')->nullable()->after('payment_url');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_provider', 'payment_reference', 'payment_url', 'payment_meta']);
        });
    }
};
