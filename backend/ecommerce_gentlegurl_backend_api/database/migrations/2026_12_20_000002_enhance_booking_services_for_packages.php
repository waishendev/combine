<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (!Schema::hasColumn('booking_services', 'price')) {
                $table->decimal('price', 10, 2)->nullable()->after('service_price');
            }

            if (!Schema::hasColumn('booking_services', 'is_package_eligible')) {
                $table->boolean('is_package_eligible')->default(true)->after('service_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'is_package_eligible')) {
                $table->dropColumn('is_package_eligible');
            }

            if (Schema::hasColumn('booking_services', 'price')) {
                $table->dropColumn('price');
            }
        });
    }
};
