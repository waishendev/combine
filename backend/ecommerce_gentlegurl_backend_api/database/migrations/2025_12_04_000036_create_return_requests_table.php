<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('return_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('request_type', 30);
            $table->string('status', 30);
            $table->string('reason', 255)->nullable();
            $table->text('description')->nullable();
            $table->jsonb('initial_image_urls')->nullable();
            $table->text('admin_note')->nullable();
            $table->string('return_courier_name', 100)->nullable();
            $table->string('return_tracking_no', 100)->nullable();
            $table->timestamp('return_shipped_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('return_requests');
    }
};
