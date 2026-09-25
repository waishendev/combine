<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_question_preset_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_question_preset_id')->constrained('booking_question_presets')->cascadeOnDelete();
            $table->string('title');
            $table->string('cn_title')->nullable();
            $table->text('description')->nullable();
            $table->text('cn_description')->nullable();
            $table->enum('question_type', ['single_choice', 'multi_choice'])->default('single_choice');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['booking_question_preset_id', 'sort_order'], 'bqpp_questions_order_idx');
        });

        Schema::table('booking_question_preset_options', function (Blueprint $table) {
            $table->foreignId('booking_question_preset_question_id')->nullable()->after('booking_question_preset_id')
                ->constrained('booking_question_preset_questions')->cascadeOnDelete();
            $table->foreignId('linked_booking_service_id')->nullable()->after('cn_label')
                ->constrained('booking_services')->nullOnDelete();
            $table->index(['booking_question_preset_question_id', 'sort_order'], 'bqpp_options_question_order_idx');
        });

        // Convert V1's single question per preset into the new nested structure without a backfill command.
        DB::table('booking_question_presets')->orderBy('id')->each(function ($preset): void {
            $questionId = DB::table('booking_question_preset_questions')->insertGetId([
                'booking_question_preset_id' => $preset->id,
                'title' => $preset->title,
                'cn_title' => $preset->cn_title,
                'description' => $preset->description,
                'cn_description' => $preset->cn_description,
                'question_type' => $preset->question_type,
                'sort_order' => 0,
                'is_required' => $preset->is_required,
                'is_active' => $preset->is_active,
                'created_at' => $preset->created_at,
                'updated_at' => $preset->updated_at,
            ]);
            DB::table('booking_question_preset_options')->where('booking_question_preset_id', $preset->id)
                ->update(['booking_question_preset_question_id' => $questionId]);
        });
    }

    public function down(): void
    {
        Schema::table('booking_question_preset_options', function (Blueprint $table) {
            $table->dropForeign(['linked_booking_service_id']);
            $table->dropForeign(['booking_question_preset_question_id']);
            $table->dropIndex('bqpp_options_question_order_idx');
            $table->dropColumn(['linked_booking_service_id', 'booking_question_preset_question_id']);
        });
        Schema::dropIfExists('booking_question_preset_questions');
    }
};
