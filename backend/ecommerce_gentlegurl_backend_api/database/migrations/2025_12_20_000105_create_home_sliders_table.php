<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_sliders', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->string('title', 255);
            $table->string('subtitle', 255)->nullable();

            $table->string('image_path', 255);
            $table->string('mobile_image_path', 255)->nullable();

            $table->string('button_label', 100)->nullable();
            $table->string('button_link', 255)->nullable();

            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();

            $table->boolean('is_active')->default(true);

            $table->integer('sort_order')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('home_sliders');
    }
};
