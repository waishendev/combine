<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('home_sliders', function (Blueprint $table) {
            $table->string('type')->default('ecommerce')->after('mobile_image_path');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::table('home_sliders', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropColumn('type');
        });
    }
};
