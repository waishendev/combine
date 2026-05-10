<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_service_questions', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_service_questions', 'cn_title')) {
                $table->string('cn_title')->nullable()->after('title');
            }
            if (! Schema::hasColumn('booking_service_questions', 'cn_description')) {
                $table->text('cn_description')->nullable()->after('description');
            }
        });

        Schema::table('booking_service_question_options', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_service_question_options', 'cn_label')) {
                $table->string('cn_label')->nullable()->after('label');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_service_question_options', function (Blueprint $table) {
            if (Schema::hasColumn('booking_service_question_options', 'cn_label')) {
                $table->dropColumn('cn_label');
            }
        });

        Schema::table('booking_service_questions', function (Blueprint $table) {
            if (Schema::hasColumn('booking_service_questions', 'cn_description')) {
                $table->dropColumn('cn_description');
            }
            if (Schema::hasColumn('booking_service_questions', 'cn_title')) {
                $table->dropColumn('cn_title');
            }
        });
    }
};
