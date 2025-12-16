<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('seo_global', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('default_title', 255);
            $table->text('default_description')->nullable();
            $table->text('default_keywords')->nullable();
            $table->string('default_og_image', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seo_global');
    }
};
