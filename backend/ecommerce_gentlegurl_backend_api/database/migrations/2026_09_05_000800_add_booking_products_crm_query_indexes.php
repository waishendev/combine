<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * booking-products-crm-query-v1 — products list/show + product-categories sort indexes.
 */
return new class extends Migration
{
    private const QUESTIONS_PRODUCT = 'booking_product_questions_product_id_idx';

    private const OPTIONS_QUESTION = 'booking_product_question_options_question_id_idx';

    private const CATEGORIES_SORT = 'booking_product_categories_sort_order_id_idx';

    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('booking_product_questions')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::QUESTIONS_PRODUCT
                    .' ON booking_product_questions (booking_product_id)'
                );
            } elseif (! $this->indexExists('booking_product_questions', self::QUESTIONS_PRODUCT)
                && ! $this->indexExists('booking_product_questions', 'booking_product_questions_booking_product_id_foreign')) {
                Schema::table('booking_product_questions', function (Blueprint $table) {
                    $table->index(['booking_product_id'], self::QUESTIONS_PRODUCT);
                });
            }
        }

        if (Schema::hasTable('booking_product_question_options')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::OPTIONS_QUESTION
                    .' ON booking_product_question_options (booking_product_question_id)'
                );
            } elseif (! $this->indexExists('booking_product_question_options', self::OPTIONS_QUESTION)
                && ! $this->indexExists('booking_product_question_options', 'booking_product_question_options_booking_product_question_id_foreign')) {
                Schema::table('booking_product_question_options', function (Blueprint $table) {
                    $table->index(['booking_product_question_id'], self::OPTIONS_QUESTION);
                });
            }
        }

        if (Schema::hasTable('booking_product_categories')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::CATEGORIES_SORT
                    .' ON booking_product_categories (sort_order, id)'
                );
            } elseif (! $this->indexExists('booking_product_categories', self::CATEGORIES_SORT)) {
                Schema::table('booking_product_categories', function (Blueprint $table) {
                    $table->index(['sort_order', 'id'], self::CATEGORIES_SORT);
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('DROP INDEX IF EXISTS '.self::QUESTIONS_PRODUCT);
            DB::statement('DROP INDEX IF EXISTS '.self::OPTIONS_QUESTION);
            DB::statement('DROP INDEX IF EXISTS '.self::CATEGORIES_SORT);

            return;
        }

        if (Schema::hasTable('booking_product_questions')
            && $this->indexExists('booking_product_questions', self::QUESTIONS_PRODUCT)) {
            Schema::table('booking_product_questions', function (Blueprint $table) {
                $table->dropIndex(self::QUESTIONS_PRODUCT);
            });
        }

        if (Schema::hasTable('booking_product_question_options')
            && $this->indexExists('booking_product_question_options', self::OPTIONS_QUESTION)) {
            Schema::table('booking_product_question_options', function (Blueprint $table) {
                $table->dropIndex(self::OPTIONS_QUESTION);
            });
        }

        if (Schema::hasTable('booking_product_categories')
            && $this->indexExists('booking_product_categories', self::CATEGORIES_SORT)) {
            Schema::table('booking_product_categories', function (Blueprint $table) {
                $table->dropIndex(self::CATEGORIES_SORT);
            });
        }
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
