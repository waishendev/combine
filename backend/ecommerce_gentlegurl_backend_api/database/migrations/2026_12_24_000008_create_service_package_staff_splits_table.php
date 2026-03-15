<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_package_staff_splits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('customer_service_package_id')->constrained('customer_service_packages')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->unsignedTinyInteger('share_percent');
            $table->decimal('split_sales_amount', 10, 2)->default(0);
            $table->decimal('service_commission_rate_snapshot', 6, 4)->default(0);
            $table->decimal('commission_amount_snapshot', 10, 2)->default(0);
            $table->timestamps();

            $table->index(['order_id', 'service_package_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_package_staff_splits');
    }
};
