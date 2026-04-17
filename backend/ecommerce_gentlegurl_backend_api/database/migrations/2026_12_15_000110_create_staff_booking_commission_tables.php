<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('staff_commission_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->default('BOOKING');
            $table->decimal('min_sales', 12, 2);
            $table->decimal('commission_percent', 5, 2);
            $table->timestamps();

            $table->index(['type', 'min_sales']);
            $table->unique(['type', 'min_sales']);
        });

        Schema::create('staff_monthly_sales', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->default('BOOKING');
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->decimal('total_sales', 12, 2)->default(0);
            $table->unsignedInteger('booking_count')->default(0);
            $table->decimal('tier_percent', 5, 2)->default(0);
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->boolean('is_overridden')->default(false);
            $table->decimal('override_amount', 12, 2)->nullable();
            $table->timestamps();

            $table->unique(['type', 'staff_id', 'year', 'month']);
            $table->index(['type', 'year', 'month']);
        });

        DB::table('staff_commission_tiers')->insert([
            ['type' => 'BOOKING', 'min_sales' => 0, 'commission_percent' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'BOOKING', 'min_sales' => 5000, 'commission_percent' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'BOOKING', 'min_sales' => 8000, 'commission_percent' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'ECOMMERCE', 'min_sales' => 0, 'commission_percent' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'ECOMMERCE', 'min_sales' => 5000, 'commission_percent' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'ECOMMERCE', 'min_sales' => 8000, 'commission_percent' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_monthly_sales');
        Schema::dropIfExists('staff_commission_tiers');
    }
};
