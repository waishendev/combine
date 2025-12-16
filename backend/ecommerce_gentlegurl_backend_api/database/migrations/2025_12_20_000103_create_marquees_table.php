<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('marquees', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->text('text');

            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();

            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marquees');
    }
};
