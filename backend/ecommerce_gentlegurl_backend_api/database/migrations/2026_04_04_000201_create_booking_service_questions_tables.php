<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_service_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('question_type', ['single_choice', 'multi_choice'])->default('single_choice');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['booking_service_id', 'is_active']);
        });

        Schema::create('booking_service_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_question_id')->constrained('booking_service_questions')->cascadeOnDelete();
            $table->string('label');
            $table->foreignId('linked_booking_service_id')->nullable()->constrained('booking_services')->nullOnDelete();
            $table->unsignedInteger('extra_duration_min')->default(0);
            $table->decimal('extra_price', 12, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['booking_service_question_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_service_question_options');
        Schema::dropIfExists('booking_service_questions');
    }
};
