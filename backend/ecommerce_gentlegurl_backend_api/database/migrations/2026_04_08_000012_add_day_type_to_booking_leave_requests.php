<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('booking_leave_requests', 'day_type')) {
            Schema::table('booking_leave_requests', function (Blueprint $table) {
                $table->enum('day_type', ['full_day', 'half_day_am', 'half_day_pm'])
                    ->default('full_day')
                    ->after('leave_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('booking_leave_requests', 'day_type')) {
            Schema::table('booking_leave_requests', function (Blueprint $table) {
                $table->dropColumn('day_type');
            });
        }
    }
};
