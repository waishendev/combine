<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('selling_price', 10, 2);
            $table->unsignedInteger('valid_days')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('service_package_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
            $table->unique(['service_package_id', 'booking_service_id']);
        });

        Schema::create('customer_service_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->enum('purchased_from', ['POS', 'BOOKING', 'ADMIN'])->default('ADMIN');
            $table->unsignedBigInteger('purchased_ref_id')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->enum('status', ['active', 'exhausted', 'expired', 'cancelled'])->default('active');
            $table->timestamps();
            $table->index(['customer_id', 'status']);
        });

        Schema::create('customer_service_package_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_package_id')->constrained('customer_service_packages')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->unsignedInteger('total_qty');
            $table->unsignedInteger('used_qty')->default(0);
            $table->unsignedInteger('remaining_qty');
            $table->timestamps();
            $table->unique(['customer_service_package_id', 'booking_service_id'], 'customer_service_pkg_balance_unique');
        });

        Schema::create('customer_service_package_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_package_id')->constrained('customer_service_packages')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->unsignedInteger('used_qty')->default(1);
            $table->enum('used_from', ['POS', 'BOOKING', 'ADMIN'])->default('ADMIN');
            $table->unsignedBigInteger('used_ref_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['customer_id', 'booking_service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_service_package_usages');
        Schema::dropIfExists('customer_service_package_balances');
        Schema::dropIfExists('customer_service_packages');
        Schema::dropIfExists('service_package_items');
        Schema::dropIfExists('service_packages');
    }
};
