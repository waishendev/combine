<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->boolean('billing_same_as_shipping')->default(true)->after('guest_email');
            $table->string('billing_name')->nullable()->after('billing_same_as_shipping');
            $table->string('billing_phone', 50)->nullable()->after('billing_name');
            $table->string('billing_email')->nullable()->after('billing_phone');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'billing_same_as_shipping',
                'billing_name',
                'billing_phone',
                'billing_email',
            ]);
        });
    }
};
