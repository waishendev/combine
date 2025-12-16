<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loyalty_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->decimal('base_multiplier', 8, 2)->default(1.00);
            $table->integer('expiry_months')->default(12);
            $table->integer('evaluation_cycle_months')->default(6);
            $table->date('rules_effective_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_settings');
    }
};
