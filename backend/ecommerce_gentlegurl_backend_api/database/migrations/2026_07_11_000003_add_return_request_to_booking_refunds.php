<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->dropForeign(['booking_id']);
        });

        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_id')->nullable()->change();
            $table->foreignId('return_request_id')->nullable()->after('order_id')->constrained('return_requests')->nullOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->dropForeign(['return_request_id']);
            $table->dropForeign(['booking_id']);
            $table->dropColumn('return_request_id');
        });

        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_id')->nullable(false)->change();
            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
        });
    }
};
