<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('booking_service_id')->constrained('customers')->nullOnDelete();
            $table->dateTime('start_at')->nullable()->after('assigned_staff_id');
            $table->dateTime('end_at')->nullable()->after('start_at');
            $table->text('notes')->nullable()->after('end_at');
            $table->json('staff_splits')->nullable()->after('notes');
        });

        Schema::table('order_service_items', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('booking_service_id')->constrained('customers')->nullOnDelete();
            $table->dateTime('start_at')->nullable()->after('assigned_staff_id');
            $table->dateTime('end_at')->nullable()->after('start_at');
            $table->text('notes')->nullable()->after('end_at');
            $table->json('staff_splits')->nullable()->after('notes');
            $table->foreignId('booking_id')->nullable()->after('order_id')->constrained('bookings')->nullOnDelete();
        });

        Schema::create('booking_service_staff_splits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->unsignedTinyInteger('split_percent');
            $table->decimal('service_commission_rate_snapshot', 6, 4)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_service_staff_splits');

        Schema::table('order_service_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('booking_id');
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn(['start_at', 'end_at', 'notes', 'staff_splits']);
        });

        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn(['start_at', 'end_at', 'notes', 'staff_splits']);
        });
    }
};
