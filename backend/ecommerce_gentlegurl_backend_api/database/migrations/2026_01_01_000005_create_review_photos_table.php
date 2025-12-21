<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained('page_reviews')->cascadeOnDelete();
            $table->string('file_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_photos');
    }
};
