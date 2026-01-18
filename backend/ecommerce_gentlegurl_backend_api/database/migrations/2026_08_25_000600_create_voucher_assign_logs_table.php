<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_assign_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('assigned_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('assigned_at');
            $table->timestamps();

            $table->index(['assigned_at']);
            $table->index(['customer_id', 'voucher_id']);
            $table->index(['assigned_by_admin_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_assign_logs');
    }
};
