<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('points_redemption_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('redemption_id')->constrained('points_redemptions')->cascadeOnDelete();
            $table->foreignId('earn_batch_id')->constrained('points_earn_batches')->restrictOnDelete();
            $table->integer('points_used');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('points_redemption_items');
    }
};
