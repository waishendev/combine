<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('services_page_slides', function (Blueprint $table) {
            $table->renameColumn('desktop_src', 'image_path');
            $table->renameColumn('mobile_src', 'mobile_image_path');
            $table->renameColumn('button_href', 'button_link');
        });

        Schema::table('services_page_slides', function (Blueprint $table) {
            $table->dropColumn('alt');
        });
    }

    public function down(): void
    {
        Schema::table('services_page_slides', function (Blueprint $table) {
            $table->string('alt', 255)->default('');
        });

        Schema::table('services_page_slides', function (Blueprint $table) {
            $table->renameColumn('image_path', 'desktop_src');
            $table->renameColumn('mobile_image_path', 'mobile_src');
            $table->renameColumn('button_link', 'button_href');
        });
    }
};
