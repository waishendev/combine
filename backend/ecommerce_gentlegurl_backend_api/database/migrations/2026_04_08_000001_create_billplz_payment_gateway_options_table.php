<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('billplz_payment_gateway_options', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30)->default('ecommerce');
            $table->string('gateway_group', 30);
            $table->string('code', 100);
            $table->string('name', 150);
            $table->string('logo_url')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->integer('sort_order')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['type', 'gateway_group', 'is_active']);
            $table->unique(['type', 'gateway_group', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billplz_payment_gateway_options');
    }
};
