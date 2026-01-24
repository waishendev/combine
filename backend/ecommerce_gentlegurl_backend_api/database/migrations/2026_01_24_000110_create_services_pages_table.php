<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('services_pages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('services_menu_item_id')
                ->unique()
                ->constrained('services_menu_items')
                ->cascadeOnDelete();
            $table->string('title', 150);
            $table->string('slug', 150)->unique();
            $table->string('subtitle', 500)->nullable();
            $table->json('hero_slides')->nullable();
            $table->json('sections');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services_pages');
    }
};
