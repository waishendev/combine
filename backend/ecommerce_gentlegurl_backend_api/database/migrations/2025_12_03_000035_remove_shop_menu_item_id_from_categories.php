<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'shop_menu_item_id')) {
                $table->dropConstrainedForeignId('shop_menu_item_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'shop_menu_item_id')) {
                $table->foreignId('shop_menu_item_id')
                    ->nullable()
                    ->after('parent_id')
                    ->constrained('shop_menu_items')
                    ->nullOnDelete();
            }
        });
    }
};
