<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('billing_name')->nullable()->after('guest_email');
            $table->string('billing_phone')->nullable()->after('billing_name');
            $table->string('billing_email')->nullable()->after('billing_phone');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'billing_name',
                'billing_phone',
                'billing_email',
            ]);
        });
    }
};
