<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('requested_payment_method', 50)->nullable()->after('payment_method');
            $table->string('selected_gateway_code', 100)->nullable()->after('payment_gateway_id');
            $table->string('selected_gateway_name', 150)->nullable()->after('selected_gateway_code');
            $table->foreignId('billplz_gateway_option_id')->nullable()->after('selected_gateway_name')->constrained('billplz_payment_gateway_options')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('billplz_gateway_option_id');
            $table->dropColumn(['requested_payment_method', 'selected_gateway_code', 'selected_gateway_name']);
        });
    }
};
