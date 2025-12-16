<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shop_menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('shop_menu_items', 'category_id')) {
                $table->dropForeign(['category_id']);
                $table->dropColumn('category_id');
            }
        });

        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'shop_menu_item_id')) {
                $table->unsignedBigInteger('shop_menu_item_id')
                    ->nullable()
                    ->after('parent_id');

                $table->foreign('shop_menu_item_id')
                    ->references('id')
                    ->on('shop_menu_items')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'shop_menu_item_id')) {
                $table->dropForeign(['shop_menu_item_id']);
                $table->dropColumn('shop_menu_item_id');
            }
        });

        Schema::table('shop_menu_items', function (Blueprint $table) {
            if (!Schema::hasColumn('shop_menu_items', 'category_id')) {
                $table->unsignedBigInteger('category_id')->nullable()->after('slug');
                $table->foreign('category_id')
                    ->references('id')
                    ->on('categories')
                    ->nullOnDelete();
            }
        });
    }
};
