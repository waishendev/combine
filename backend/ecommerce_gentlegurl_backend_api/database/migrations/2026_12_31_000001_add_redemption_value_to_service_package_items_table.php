<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_package_items', function (Blueprint $table) {
            if (! Schema::hasColumn('service_package_items', 'redemption_value')) {
                $table->decimal('redemption_value', 10, 2)->default(0)->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_package_items', function (Blueprint $table) {
            if (Schema::hasColumn('service_package_items', 'redemption_value')) {
                $table->dropColumn('redemption_value');
            }
        });
    }
};
