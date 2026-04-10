<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_landing_pages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('slug', 150)->unique()->default('home');
            $table->json('sections');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_landing_pages');
    }
};
