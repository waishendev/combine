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
            $table->foreignId('staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->unsignedTinyInteger('share_percent');
            $table->timestamps();

            $table->unique(['order_item_id', 'staff_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_staff_splits');
    }
};
