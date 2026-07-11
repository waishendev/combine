<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_leave_requests', 'change_reason')) {
                $table->string('change_reason')->nullable()->after('reason');
            }
            if (! Schema::hasColumn('booking_leave_requests', 'date_change_pending')) {
                $table->boolean('date_change_pending')->default(false)->after('source_leave_request_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if (Schema::hasColumn('booking_leave_requests', 'date_change_pending')) {
                $table->dropColumn('date_change_pending');
            }
            if (Schema::hasColumn('booking_leave_requests', 'change_reason')) {
                $table->dropColumn('change_reason');
            }
        });
    }
};
