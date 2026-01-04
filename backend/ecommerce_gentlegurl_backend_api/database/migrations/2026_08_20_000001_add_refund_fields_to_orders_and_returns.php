<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('refund_total', 12, 2)->default(0);
        });

        Schema::table('return_requests', function (Blueprint $table) {
            $table->decimal('refund_amount', 12, 2)->nullable();
            $table->string('refund_method', 30)->nullable();
            $table->string('refund_proof_path', 255)->nullable();
            $table->timestamp('refunded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('refund_total');
        });

        Schema::table('return_requests', function (Blueprint $table) {
            $table->dropColumn(['refund_amount', 'refund_method', 'refund_proof_path', 'refunded_at']);
        });
    }
};
