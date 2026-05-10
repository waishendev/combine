<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cash_shifts', 'opened_staff_id')) {
                $table->foreignId('opened_staff_id')->nullable()->after('opened_by')->constrained('staffs')->nullOnDelete();
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'closed_staff_id')) {
                $table->foreignId('closed_staff_id')->nullable()->after('closed_by')->constrained('staffs')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cash_shifts', 'closed_staff_id')) {
                $table->dropConstrainedForeignId('closed_staff_id');
            }

            if (Schema::hasColumn('pos_cash_shifts', 'opened_staff_id')) {
                $table->dropConstrainedForeignId('opened_staff_id');
            }
        });
    }
};
