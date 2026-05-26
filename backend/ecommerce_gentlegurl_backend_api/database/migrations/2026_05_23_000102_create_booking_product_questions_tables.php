<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_product_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_product_id')->constrained('booking_products')->cascadeOnDelete();
            $table->string('title');
            $table->string('cn_title')->nullable();
            $table->text('description')->nullable();
            $table->text('cn_description')->nullable();
            $table->enum('question_type', ['single_choice', 'multi_choice'])->default('single_choice');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('booking_product_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_product_question_id')->constrained('booking_product_questions')->cascadeOnDelete();
            $table->string('label');
            $table->string('cn_label')->nullable();
            $table->decimal('extra_price', 12, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_product_question_options');
        Schema::dropIfExists('booking_product_questions');
    }
};
