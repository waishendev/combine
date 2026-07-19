<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('payment_gateways', 'category')) {
            Schema::table('payment_gateways', function (Blueprint $table) {
                $table->string('category', 40)->default('external_gateway')->after('key')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payment_gateways', 'category')) {
            Schema::table('payment_gateways', function (Blueprint $table) {
                $table->dropIndex(['category']);
                $table->dropColumn('category');
            });
        }
    }
};
