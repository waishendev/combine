<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guest_wishlist_items', function (Blueprint $table) {
            $table->id();
            $table->string('session_token', 100)->index();
            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['session_token', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_wishlist_items');
    }
};
