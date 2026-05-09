<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('order_payments')) {
            return;
        }

        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('payment_method', 50);
            $table->decimal('amount', 12, 2);
            $table->string('reference_no', 100)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'payment_method']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
    }
};
