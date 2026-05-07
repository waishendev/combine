<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_service_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_service_categories', 'cn_name')) {
                $table->string('cn_name')->nullable()->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_service_categories', function (Blueprint $table) {
            if (Schema::hasColumn('booking_service_categories', 'cn_name')) {
                $table->dropColumn('cn_name');
            }
        });
    }
};
