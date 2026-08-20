<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->foreignId('store_location_id')->nullable()->after('id')->constrained('store_locations')->restrictOnDelete();
            $table->unique(['store_location_id', 'name']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('id')->constrained('store_locations')->restrictOnDelete();
            $table->index(['store_location_id', 'expense_date']);
            $table->index(['store_location_id', 'expense_category_id']);
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex(['store_location_id', 'expense_date']);
            $table->dropIndex(['store_location_id', 'expense_category_id']);
            $table->dropConstrainedForeignId('store_location_id');
        });

        Schema::table('expense_categories', function (Blueprint $table) {
            $table->dropUnique(['store_location_id', 'name']);
            $table->dropConstrainedForeignId('store_location_id');
            $table->unique('name');
        });
    }
};
