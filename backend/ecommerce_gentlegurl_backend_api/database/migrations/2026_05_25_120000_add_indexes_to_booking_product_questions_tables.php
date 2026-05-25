<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_product_questions', function (Blueprint $table) {
            $table->index(['booking_product_id', 'is_active'], 'bp_questions_product_active_idx');
        });

        Schema::table('booking_product_question_options', function (Blueprint $table) {
            $table->index(['booking_product_question_id', 'is_active'], 'bp_question_options_question_active_idx');
        });
    }

    public function down(): void
    {
        Schema::table('booking_product_question_options', function (Blueprint $table) {
            $table->dropIndex('bp_question_options_question_active_idx');
        });

        Schema::table('booking_product_questions', function (Blueprint $table) {
            $table->dropIndex('bp_questions_product_active_idx');
        });
    }
};
