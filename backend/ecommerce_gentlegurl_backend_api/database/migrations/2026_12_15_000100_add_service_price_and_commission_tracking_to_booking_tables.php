<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'completed_at')) {
                $table->dateTime('completed_at')->nullable()->after('hold_expires_at');
                $table->index('completed_at');
            }

            if (!Schema::hasColumn('bookings', 'commission_counted_at')) {
                $table->dateTime('commission_counted_at')->nullable()->after('completed_at');
                $table->index('commission_counted_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'commission_counted_at')) {
                $table->dropIndex(['commission_counted_at']);
                $table->dropColumn('commission_counted_at');
            }

            if (Schema::hasColumn('bookings', 'completed_at')) {
                $table->dropIndex(['completed_at']);
                $table->dropColumn('completed_at');
            }
        });
    }
};

