<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('membership_tier_rules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('tier', 30);
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->string('badge_image_path')->nullable();
            $table->decimal('min_spent_last_x_months', 12, 2);
            $table->integer('months_window')->default(6);
            $table->decimal('multiplier', 8, 2);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_tier_rules');
    }
};
