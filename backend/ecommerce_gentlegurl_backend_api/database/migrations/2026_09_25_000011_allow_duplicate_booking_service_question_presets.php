<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_service_question_presets', function (Blueprint $table) {
            $table->dropUnique('booking_service_question_presets_unique');
            $table->index(
                ['booking_service_id', 'booking_question_preset_id'],
                'booking_service_question_presets_service_preset_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('booking_service_question_presets', function (Blueprint $table) {
            $table->dropIndex('booking_service_question_presets_service_preset_idx');
            $table->unique(
                ['booking_service_id', 'booking_question_preset_id'],
                'booking_service_question_presets_unique'
            );
        });
    }
};
