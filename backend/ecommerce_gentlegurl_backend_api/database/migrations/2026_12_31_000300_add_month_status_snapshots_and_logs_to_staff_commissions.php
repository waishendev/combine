<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_monthly_sales', function (Blueprint $table) {
            if (! Schema::hasColumn('staff_monthly_sales', 'tier_id_snapshot')) {
                $table->unsignedBigInteger('tier_id_snapshot')->nullable()->after('override_amount');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'tier_percent_snapshot')) {
                $table->decimal('tier_percent_snapshot', 5, 2)->nullable()->after('tier_id_snapshot');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'tier_min_sales_snapshot')) {
                $table->decimal('tier_min_sales_snapshot', 12, 2)->nullable()->after('tier_percent_snapshot');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'calculated_at')) {
                $table->dateTime('calculated_at')->nullable()->after('tier_min_sales_snapshot');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'status')) {
                $table->enum('status', ['OPEN', 'FROZEN'])->default('OPEN')->after('calculated_at');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'frozen_at')) {
                $table->dateTime('frozen_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'frozen_by')) {
                $table->unsignedBigInteger('frozen_by')->nullable()->after('frozen_at');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'reopened_at')) {
                $table->dateTime('reopened_at')->nullable()->after('frozen_by');
            }
            if (! Schema::hasColumn('staff_monthly_sales', 'reopened_by')) {
                $table->unsignedBigInteger('reopened_by')->nullable()->after('reopened_at');
            }

            $table->index(['status']);
            $table->index(['type', 'year', 'month', 'status']);
        });

        Schema::create('staff_commission_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('staff_monthly_sale_id')->nullable();
            $table->unsignedBigInteger('staff_id');
            $table->string('type', 20);
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('action', 50);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'type', 'year', 'month']);
            $table->index(['action']);
            $table->index(['staff_monthly_sale_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_commission_logs');

        Schema::table('staff_monthly_sales', function (Blueprint $table) {
            foreach ([
                'reopened_by',
                'reopened_at',
                'frozen_by',
                'frozen_at',
                'status',
                'calculated_at',
                'tier_min_sales_snapshot',
                'tier_percent_snapshot',
                'tier_id_snapshot',
            ] as $column) {
                if (Schema::hasColumn('staff_monthly_sales', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
