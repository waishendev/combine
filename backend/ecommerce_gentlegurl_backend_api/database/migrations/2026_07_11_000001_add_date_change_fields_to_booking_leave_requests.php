<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_leave_requests', 'request_kind')) {
                $table->string('request_kind', 20)->default('new')->after('leave_type');
            }
            if (! Schema::hasColumn('booking_leave_requests', 'source_leave_request_id')) {
                $table->foreignId('source_leave_request_id')
                    ->nullable()
                    ->after('request_kind')
                    ->constrained('booking_leave_requests')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if (Schema::hasColumn('booking_leave_requests', 'source_leave_request_id')) {
                $table->dropConstrainedForeignId('source_leave_request_id');
            }
            if (Schema::hasColumn('booking_leave_requests', 'request_kind')) {
                $table->dropColumn('request_kind');
            }
        });
    }
};
