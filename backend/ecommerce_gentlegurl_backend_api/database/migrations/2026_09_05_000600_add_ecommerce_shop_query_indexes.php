<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ecommerce-shop-query-v1 — shop list / filter composite indexes.
 */
return new class extends Migration
{
    private const SHOP_LIST = 'products_shop_list_created_at_desc_idx';

    private const SHOP_PRICE = 'products_shop_list_price_idx';

    public function up(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement(
                'CREATE INDEX IF NOT EXISTS '.self::SHOP_LIST
                .' ON products (is_active, is_hidden_in_shop, is_reward_only, created_at DESC)'
            );
            DB::statement(
                'CREATE INDEX IF NOT EXISTS '.self::SHOP_PRICE
                .' ON products (is_active, is_hidden_in_shop, is_reward_only, price)'
            );

            return;
        }

        Schema::table('products', function (Blueprint $table) {
            if (! $this->indexExists('products', self::SHOP_LIST)) {
                $table->index(
                    ['is_active', 'is_hidden_in_shop', 'is_reward_only', 'created_at'],
                    self::SHOP_LIST
                );
            }
            if (! $this->indexExists('products', self::SHOP_PRICE)) {
                $table->index(
                    ['is_active', 'is_hidden_in_shop', 'is_reward_only', 'price'],
                    self::SHOP_PRICE
                );
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('DROP INDEX IF EXISTS '.self::SHOP_LIST);
            DB::statement('DROP INDEX IF EXISTS '.self::SHOP_PRICE);

            return;
        }

        Schema::table('products', function (Blueprint $table) {
            if ($this->indexExists('products', self::SHOP_LIST)) {
                $table->dropIndex(self::SHOP_LIST);
            }
            if ($this->indexExists('products', self::SHOP_PRICE)) {
                $table->dropIndex(self::SHOP_PRICE);
            }
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $schema = $connection->getSchemaBuilder();

        if (method_exists($schema, 'hasIndex')) {
            return $schema->hasIndex($table, $index);
        }

        $database = $connection->getDatabaseName();
        $rows = $connection->select(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $index]
        );

        return ! empty($rows);
    }
};
