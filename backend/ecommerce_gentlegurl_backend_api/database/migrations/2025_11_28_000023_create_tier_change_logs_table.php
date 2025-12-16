<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tier_change_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('old_tier', 30);
            $table->string('new_tier', 30);
            $table->string('reason', 50);
            $table->date('evaluated_period_start')->nullable();
            $table->date('evaluated_period_end')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tier_change_logs');
    }
};
