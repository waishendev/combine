<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Request-scoped memoization for Schema::hasTable / hasColumn / column listings.
 * Dashboard analytics controllers call these repeatedly while building SQL expressions;
 * caching avoids dozens of pg_catalog round-trips per request without changing results.
 *
 * Cache is shared via the current Request attributes so overview (multiple controllers)
 * does not re-introspect the same tables.
 */
trait MemoizesSchemaLookups
{
    private const ATTR_TABLES = '_dash_schema_tables';

    private const ATTR_COLUMNS = '_dash_schema_columns';

    private const ATTR_LISTS = '_dash_schema_lists';

    /** @var array<string, bool> */
    private array $schemaTableCache = [];

    /** @var array<string, bool> */
    private array $schemaColumnCache = [];

    /** @var array<string, list<string>> */
    private array $schemaColumnListCache = [];

    private function schemaHasTable(string $table): bool
    {
        if (array_key_exists($table, $this->schemaTableCache)) {
            return $this->schemaTableCache[$table];
        }

        $shared = $this->requestAttr(self::ATTR_TABLES);
        if (array_key_exists($table, $shared)) {
            return $this->schemaTableCache[$table] = $shared[$table];
        }

        $value = Schema::hasTable($table);
        $shared[$table] = $value;
        $this->setRequestAttr(self::ATTR_TABLES, $shared);

        return $this->schemaTableCache[$table] = $value;
    }

    /**
     * One catalog round-trip per table per request; subsequent hasColumn checks are in-memory.
     *
     * @return list<string>
     */
    private function schemaColumnList(string $table): array
    {
        if (array_key_exists($table, $this->schemaColumnListCache)) {
            return $this->schemaColumnListCache[$table];
        }

        $shared = $this->requestAttr(self::ATTR_LISTS);
        if (array_key_exists($table, $shared)) {
            return $this->schemaColumnListCache[$table] = $shared[$table];
        }

        $list = Schema::getColumnListing($table);
        $shared[$table] = $list;
        $this->setRequestAttr(self::ATTR_LISTS, $shared);

        return $this->schemaColumnListCache[$table] = $list;
    }

    private function schemaHasColumn(string $table, string $column): bool
    {
        $key = $table.'.'.$column;
        if (array_key_exists($key, $this->schemaColumnCache)) {
            return $this->schemaColumnCache[$key];
        }

        $shared = $this->requestAttr(self::ATTR_COLUMNS);
        if (array_key_exists($key, $shared)) {
            return $this->schemaColumnCache[$key] = $shared[$key];
        }

        $value = in_array($column, $this->schemaColumnList($table), true);
        $shared[$key] = $value;
        $this->setRequestAttr(self::ATTR_COLUMNS, $shared);

        return $this->schemaColumnCache[$key] = $value;
    }

    /**
     * Prefetch table existence + column lists in one catalog round-trip (pgsql/mysql).
     * Safe: same answers as Schema::hasTable / getColumnListing, just batched.
     *
     * @param  list<string>  $tables
     */
    private function warmSchemaTables(array $tables): void
    {
        $tables = array_values(array_unique(array_filter($tables)));
        if ($tables === []) {
            return;
        }

        $sharedTables = $this->requestAttr(self::ATTR_TABLES);
        $sharedLists = $this->requestAttr(self::ATTR_LISTS);
        $missing = [];
        foreach ($tables as $table) {
            if (! array_key_exists($table, $sharedTables) || ! array_key_exists($table, $sharedLists)) {
                $missing[] = $table;
            }
        }
        if ($missing === []) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        $found = [];

        if ($driver === 'pgsql') {
            $placeholders = implode(',', array_fill(0, count($missing), '?'));
            $rows = DB::select(
                "SELECT c.relname AS table_name, a.attname AS column_name
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                 WHERE n.nspname = current_schema()
                   AND c.relkind IN ('r', 'p')
                   AND c.relname IN ({$placeholders})
                 ORDER BY c.relname, a.attnum",
                $missing
            );
            foreach ($rows as $row) {
                $found[$row->table_name][] = $row->column_name;
            }
        } elseif ($driver === 'mysql') {
            $database = Schema::getConnection()->getDatabaseName();
            $placeholders = implode(',', array_fill(0, count($missing), '?'));
            $rows = DB::select(
                "SELECT table_name, column_name
                 FROM information_schema.columns
                 WHERE table_schema = ?
                   AND table_name IN ({$placeholders})
                 ORDER BY table_name, ordinal_position",
                array_merge([$database], $missing)
            );
            foreach ($rows as $row) {
                $found[$row->table_name][] = $row->column_name;
            }
        } else {
            foreach ($missing as $table) {
                $this->schemaHasTable($table);
                if ($this->schemaHasTable($table)) {
                    $this->schemaColumnList($table);
                }
            }

            return;
        }

        foreach ($missing as $table) {
            $exists = array_key_exists($table, $found);
            $sharedTables[$table] = $exists;
            $sharedLists[$table] = $exists ? array_values($found[$table]) : [];
            $this->schemaTableCache[$table] = $exists;
            $this->schemaColumnListCache[$table] = $sharedLists[$table];
        }

        $this->setRequestAttr(self::ATTR_TABLES, $sharedTables);
        $this->setRequestAttr(self::ATTR_LISTS, $sharedLists);
    }

    /** @return array<string, mixed> */
    private function requestAttr(string $key): array
    {
        $request = request();
        $value = $request->attributes->get($key, []);

        return is_array($value) ? $value : [];
    }

    /** @param  array<string, mixed>  $value */
    private function setRequestAttr(string $key, array $value): void
    {
        request()->attributes->set($key, $value);
    }
}
