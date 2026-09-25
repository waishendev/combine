<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_question_presets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('cn_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'name']);
        });

        Schema::create('booking_question_preset_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_question_preset_id')
                ->constrained('booking_question_presets')
                ->cascadeOnDelete();
            $table->string('title');
            $table->string('cn_title')->nullable();
            $table->text('description')->nullable();
            $table->text('cn_description')->nullable();
            $table->enum('question_type', ['single_choice', 'multi_choice'])->default('single_choice');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['booking_question_preset_id', 'is_active'], 'bq_preset_questions_preset_active_idx');
        });

        Schema::create('booking_question_preset_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_question_preset_question_id')
                ->constrained('booking_question_preset_questions')
                ->cascadeOnDelete();
            $table->string('label');
            $table->string('cn_label')->nullable();
            $table->foreignId('linked_booking_service_id')->nullable()->constrained('booking_services')->nullOnDelete();
            $table->unsignedInteger('extra_duration_min')->default(0);
            $table->decimal('extra_price', 12, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('allow_quantity')->default(true);
            $table->timestamps();

            $table->index(['booking_question_preset_question_id', 'is_active'], 'bq_preset_options_question_active_idx');
        });

        Schema::create('booking_service_question_presets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->foreignId('booking_question_preset_id')
                ->constrained('booking_question_presets')
                ->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(
                ['booking_service_id', 'booking_question_preset_id'],
                'booking_service_question_presets_unique'
            );
            $table->index(['booking_service_id', 'sort_order'], 'booking_service_question_presets_order_idx');
        });

        Schema::table('booking_service_questions', function (Blueprint $table) {
            $table->foreignId('question_preset_id')
                ->nullable()
                ->after('booking_service_id')
                ->constrained('booking_question_presets')
                ->nullOnDelete();
            $table->foreignId('source_preset_question_id')
                ->nullable()
                ->after('question_preset_id')
                ->constrained('booking_question_preset_questions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('booking_service_questions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_preset_question_id');
            $table->dropConstrainedForeignId('question_preset_id');
        });

        Schema::dropIfExists('booking_service_question_presets');
        Schema::dropIfExists('booking_question_preset_options');
        Schema::dropIfExists('booking_question_preset_questions');
        Schema::dropIfExists('booking_question_presets');
    }
};
