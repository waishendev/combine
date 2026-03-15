<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('service_package_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->restrictOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();

            $table->unique(['service_package_id', 'booking_service_id'], 'service_package_items_pkg_service_unique');
        });

        Schema::create('customer_service_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages')->restrictOnDelete();
            $table->foreignId('assigned_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('customer_service_package_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_package_id')->constrained('customer_service_packages')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->restrictOnDelete();
            $table->unsignedInteger('total_quantity')->default(0);
            $table->unsignedInteger('used_quantity')->default(0);
            $table->timestamps();

            $table->unique(['customer_service_package_id', 'booking_service_id'], 'customer_service_package_balance_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_service_package_balances');
        Schema::dropIfExists('customer_service_packages');
        Schema::dropIfExists('service_package_items');
        Schema::dropIfExists('service_packages');
    }
};
