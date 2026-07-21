<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->string('mutation_key', 64)->nullable()->unique()->after('refund_no');
        });
    }

    public function down(): void
    {
        Schema::table('booking_refunds', function (Blueprint $table) {
            $table->dropUnique(['mutation_key']);
            $table->dropColumn('mutation_key');
        });
    }
};
