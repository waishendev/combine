<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_item_staff_splits', function (Blueprint $table) {
            if (! Schema::hasColumn('order_item_staff_splits', 'commission_rate_snapshot')) {
                $table->decimal('commission_rate_snapshot', 10, 4)->nullable()->after('share_percent');
            }
        });

        if (Schema::hasColumn('order_item_staff_splits', 'commission_rate_snapshot')) {
            DB::statement('UPDATE order_item_staff_splits AS oiss SET commission_rate_snapshot = s.commission_rate FROM staffs AS s WHERE oiss.staff_id = s.id AND oiss.commission_rate_snapshot IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('order_item_staff_splits', function (Blueprint $table) {
            if (Schema::hasColumn('order_item_staff_splits', 'commission_rate_snapshot')) {
                $table->dropColumn('commission_rate_snapshot');
            }
        });
    }
};
