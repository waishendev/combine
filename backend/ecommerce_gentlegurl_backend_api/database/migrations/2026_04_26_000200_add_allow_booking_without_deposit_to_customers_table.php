<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'allow_booking_without_deposit')) {
                $table->boolean('allow_booking_without_deposit')->default(false)->after('is_active');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'allow_booking_without_deposit')) {
                $table->dropColumn('allow_booking_without_deposit');
            }
        });
    }
};
