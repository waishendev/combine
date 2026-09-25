<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_question_presets', function (Blueprint $table) {
            $table->id();
            $table->string('name')->index();
            $table->string('title');
            $table->string('cn_title')->nullable();
            $table->text('description')->nullable();
            $table->text('cn_description')->nullable();
            $table->enum('question_type', ['single_choice', 'multi_choice'])->default('single_choice');
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('booking_question_preset_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_question_preset_id')->constrained('booking_question_presets')->cascadeOnDelete();
            $table->string('label');
            $table->string('cn_label')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('allow_quantity')->default(true);
            $table->timestamps();
            $table->index(['booking_question_preset_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_question_preset_options');
        Schema::dropIfExists('booking_question_presets');
    }
};
