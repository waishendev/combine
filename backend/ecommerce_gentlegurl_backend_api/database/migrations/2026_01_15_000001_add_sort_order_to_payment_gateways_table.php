<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->integer('sort_order')->default(0)->after('is_default');
        });

        DB::table('payment_gateways')->update(['sort_order' => DB::raw('id')]);
    }

    public function down(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
