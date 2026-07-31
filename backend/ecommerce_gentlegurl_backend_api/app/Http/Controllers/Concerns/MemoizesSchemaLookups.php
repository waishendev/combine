<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Support\Facades\Schema;

/**
 * Request-scoped memoization for Schema::hasTable / hasColumn.
 * Dashboard analytics controllers call these repeatedly while building SQL expressions;
 * caching avoids dozens of pg_catalog round-trips per request without changing results.
 */
trait MemoizesSchemaLookups
{
    /** @var array<string, bool> */
    private array $schemaTableCache = [];

    /** @var array<string, bool> */
    private array $schemaColumnCache = [];

    private function schemaHasTable(string $table): bool
    {
        return $this->schemaTableCache[$table] ??= Schema::hasTable($table);
    }

    private function schemaHasColumn(string $table, string $column): bool
    {
        $key = $table.'.'.$column;

        return $this->schemaColumnCache[$key] ??= Schema::hasColumn($table, $column);
    }
}
