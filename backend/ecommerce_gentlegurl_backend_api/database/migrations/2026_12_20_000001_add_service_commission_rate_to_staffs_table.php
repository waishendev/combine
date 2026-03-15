<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('staffs', function (Blueprint $table) {
            if (!Schema::hasColumn('staffs', 'service_commission_rate')) {
                $table->decimal('service_commission_rate', 6, 4)->default(0)->after('commission_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('staffs', function (Blueprint $table) {
            if (Schema::hasColumn('staffs', 'service_commission_rate')) {
                $table->dropColumn('service_commission_rate');
            }
        });
    }
};
