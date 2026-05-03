<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('home_sliders', function (Blueprint $table) {
            $table->string('content_align')->default('left')->after('button_link');
            $table->string('content_vertical')->default('middle')->after('content_align');
            $table->string('button_align')->default('left')->after('content_vertical');
            $table->string('text_color')->nullable()->after('button_align');
            $table->string('button_style')->nullable()->after('text_color');
        });
    }

    public function down(): void
    {
        Schema::table('home_sliders', function (Blueprint $table) {
            $table->dropColumn(['content_align', 'content_vertical', 'button_align', 'text_color', 'button_style']);
        });
    }
};
