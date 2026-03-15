<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_package_items', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('service_package_id')->constrained('customers')->nullOnDelete();
            $table->json('staff_splits')->nullable()->after('qty');
        });
    }

    public function down(): void
    {
        Schema::table('pos_cart_package_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn('staff_splits');
        });
    }
};
