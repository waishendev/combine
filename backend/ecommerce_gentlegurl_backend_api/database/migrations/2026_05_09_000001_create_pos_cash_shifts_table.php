<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pos_cash_shifts', function (Blueprint $table) {
            $table->id();
            $table->decimal('opening_amount', 12, 2);
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at');
            $table->decimal('closing_amount', 12, 2)->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->string('status', 20)->default('OPEN');
            $table->text('remark')->nullable();
            $table->timestamps();

            $table->index(['status', 'opened_by']);
            $table->index(['opened_at', 'closed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_cash_shifts');
    }
};
