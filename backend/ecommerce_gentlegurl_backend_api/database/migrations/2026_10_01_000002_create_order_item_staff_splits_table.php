<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_item_staff_splits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->string('line_type')->nullable();
            $table->string('line_ref_id')->nullable();
            $table->foreignId('staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->unsignedTinyInteger('share_percent');
            $table->decimal('amount_basis', 12, 2)->nullable();
            $table->decimal('commission_rate_snapshot', 10, 4)->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_staff_splits');
    }
};
