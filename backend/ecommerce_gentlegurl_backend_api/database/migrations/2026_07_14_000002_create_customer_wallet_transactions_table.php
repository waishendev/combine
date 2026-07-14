<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('transaction_no')->unique();
            $table->string('type', 40);
            $table->string('direction', 20);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_before', 12, 2)->default(0);
            $table->decimal('balance_after', 12, 2)->default(0);
            $table->string('workspace_type', 40)->nullable()->index();
            $table->string('payment_gateway_key')->nullable()->index();
            $table->string('payment_method_label')->nullable();
            $table->string('source_type')->nullable()->index();
            $table->string('source_id')->nullable()->index();
            $table->string('reference_no')->nullable()->index();
            $table->string('status', 30)->default('pending')->index();
            $table->text('remark')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('reversed_transaction_id')->nullable()->constrained('customer_wallet_transactions')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['source_type', 'source_id']);
            $table->index(['customer_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_wallet_transactions');
    }
};
