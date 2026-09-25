<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_service_question_preset_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->foreignId('booking_question_preset_question_id')->constrained('booking_question_preset_questions')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['booking_service_id', 'booking_question_preset_question_id'], 'bsqp_service_question_unique');
            $table->index(['booking_service_id', 'sort_order'], 'bsqp_service_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_service_question_preset_assignments');
    }
};
