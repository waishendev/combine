<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staffs', function (Blueprint $table) {
            $table->string('position')->nullable()->after('email');
            $table->text('description')->nullable()->after('position');
            $table->string('avatar_path')->nullable()->after('description');
        });

        Schema::table('booking_services', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });

        Schema::table('staffs', function (Blueprint $table) {
            $table->dropColumn(['position', 'description', 'avatar_path']);
        });
    }
};
