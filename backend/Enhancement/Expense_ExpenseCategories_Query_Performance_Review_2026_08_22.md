# Expense / Expense Categories — Query Performance Review (2026-08-22)

**Scope:** CRM pages `/expenses` and `/expense-categories`  
**Constraint:** Analysis only — no business logic / API / response / UX changes.  
**Environment:** Local Postgres · 8 expenses · 5 categories · superadmin user · branch id `1` · month `2026-08`

## Page → API map

| Page | First-paint calls |
|------|-------------------|
| `/expenses` | `GET /api/expenses?page&per_page&month&branch…` **+** `GET /api/expense-categories?active_only=1&branch…` |
| `/expense-categories` | `GET /api/expense-categories?page&per_page&branch…` |

Controllers: `ExpenseController`, `ExpenseCategoryController`  
Scope helper: `ExpenseBranchScope` via `StoreLocationAccessService`

## Measured first-paint (Laravel query log)

| Scenario | Wall | SQL | Queries |
|----------|------|-----|---------|
| Expenses index (branch + month) | 107 ms | 19 ms | 8 |
| Expenses index (all branches + month) | 51 ms | 8 ms | 8 |
| Categories index page | 22 ms | 5 ms | 5 |
| Categories `active_only` (expenses dropdown) | 17 ms | 5 ms | 5 |
| Expenses page combined (2 APIs) | 44 ms | 14 ms | **13** |

Local SQL times are low because the tables are tiny. Findings below are **structural** — they dominate once row counts grow.

## Existing indexes

**expenses**
- `expense_date`
- `(expense_date, expense_category_id)`
- `(store_location_id, expense_date)`
- `(store_location_id, expense_category_id)`
- unique `expense_no`
- soft deletes: **no** `deleted_at` / partial live-row index

**expense_categories**
- `is_active`
- unique `(store_location_id, name)`
- **missing** sort/list composite `(store_location_id, sort_order, …)`

## Slow / expensive query patterns

### 1. Expenses list: three full scans of the same filter

`ExpenseController::index` does:

1. `SUM(amount)` on filtered query  
2. Laravel `paginate` → `COUNT(*)` on same filter  
3. `SELECT * … ORDER BY expense_date DESC, id DESC LIMIT/OFFSET`

**Root cause:** Same predicate applied three times (`store_location_id` + month range + `deleted_at IS NULL` [+ optional category]).

**EXPLAIN (local, branch+month list):** Seq Scan + Sort (expected at 8 rows). At scale the planner can use `(store_location_id, expense_date)` but still pays **3×** index range scans + separate sort unless the index matches `ORDER BY`.

**Safe recommendations**
| Change | Why | Trade-off |
|--------|-----|-----------|
| Partial index `expenses (store_location_id, expense_date DESC, id DESC) WHERE deleted_at IS NULL` | Matches default list filter + sort; skips soft-deleted rows | Extra storage; slightly slower inserts/updates/soft-deletes |
| Optional companion `(store_location_id, expense_category_id, expense_date DESC, id DESC) WHERE deleted_at IS NULL` | Speeds category + month filter | More write overhead |
| Future (code, same response): one SQL with window/`FILTER` for count+sum+page | Cuts 3→1 scan | Must preserve JSON shape; higher change risk |

### 2. Categories list: correlated `withCount('expenses')` per row

```sql
SELECT expense_categories.*,
  (SELECT count(*) FROM expenses
    WHERE expense_categories.id = expenses.expense_category_id
      AND expenses.deleted_at IS NULL) AS expenses_count
…
```

**Root cause:** Eloquent `withCount` emits a correlated subquery. Local EXPLAIN: SubPlan Seq Scan on `expenses` per category row. There is **no** index on `expenses(expense_category_id)` alone (only composites that start with `store_location_id` or `expense_date`).

**Used by**
- Categories page: `expenses_count` gates branch edit lock in UI  
- Expenses page dropdown (`active_only=1`): **UI never reads `expenses_count`** — wasted work every reload

**Safe recommendations**
| Change | Why | Trade-off |
|--------|-----|-----------|
| Partial index `expenses (expense_category_id) WHERE deleted_at IS NULL` | Makes each count Index Only / Index Scan | Small write cost |
| Later (optional API flag, same default): skip `withCount` when `active_only=1` | Removes N correlated counts on expenses first paint | Mild response-shape difference unless field kept as `0`/omitted carefully |

### 3. Category listing / reorder sort without supporting index

Queries:

- `ORDER BY store_location_id, sort_order, name`
- Move up/down: `WHERE store_location_id = ? AND sort_order </> ? ORDER BY sort_order`

**Root cause:** Unique `(store_location_id, name)` does not help `sort_order` neighbor lookups.

**Recommend:** `expense_categories (store_location_id, sort_order, name)`  
Optional: `(store_location_id, is_active, sort_order)` for `active_only` dropdowns.

Trade-off: small index storage; faster reads; negligible write cost given low category churn.

### 4. Duplicate branch-scope auth on expenses first paint

Each of the two parallel APIs independently:

1. Superadmin `roles` exists check  
2. `StoreLocationAccessService::authorizeStoreLocation` → `accessibleStoreLocations` with `LOWER(name) <> 'all branches'`

Observed: **13 queries** for combined first paint; branch auth alone can dominate wall time locally (one authorize hit ~11 ms).

**Root cause:** `ExpenseBranchScope::fromRequest` is not request-memoized (unlike report `ReportBranchScope`).

**Recommend (safe, behavior-identical):** request-attribute cache for `ExpenseBranchScope::fromRequest` / accessible branch ids. No API change.

### 5. Unnecessary eager loads on expenses list (not N+1)

Eager: `category`, `creator`, `storeLocation`.  
CRM table uses category / branch / receipt — **not** `creator`.

Not an N+1 (good). Extra `users` round-trip is minor today; dropping `creator` would change payload — **out of scope** unless a slim endpoint is added later.

### 6. Search path (unused by current UI filters)

`LIKE '%…%'` on `expense_no` / `title` / `remark` + `orWhereHas('category')` cannot use btree indexes. Current CRM filters are month + category only — no action required unless search is exposed.

### 7. Export

`export` loads full filtered set with relations (no pagination). Acceptable for CSV; same indexes as list help. Avoid for huge unfiltered exports.

## EXPLAIN ANALYZE summary (local)

| Query | Plan | Exec |
|-------|------|------|
| List branch + month LIMIT 15 | Seq Scan → Sort | ~0.12 ms |
| SUM amount same filter | Seq Scan aggregate | ~0.08 ms |
| Categories + withCount | Sort categories + SubPlan Seq Scan expenses | ~0.10 ms |
| Move neighbor by sort_order | Seq Scan + Sort | ~0.06 ms |

**Caveat:** With 8 rows Postgres correctly prefers Seq Scan. Re-run EXPLAIN after seeding ≥10k expenses / ≥500 categories (or on staging) to confirm Index Scan / Index Only Scan after new indexes.

## Priority (safe, low risk)

1. **P0 indexes (no behavior change)**  
   - `expenses (store_location_id, expense_date DESC, id DESC) WHERE deleted_at IS NULL`  
   - `expenses (expense_category_id) WHERE deleted_at IS NULL`  
   - `expense_categories (store_location_id, sort_order, name)`

2. **P1 request memo for `ExpenseBranchScope`** — drop duplicate auth queries on dual-fetch pages.

3. **P2 (optional, careful)** — skip or lazy `withCount` for `active_only` dropdown; combine sum/count/page in one SQL while keeping response keys identical.

## What not to do

- Do not change soft-delete semantics, branch rules, or pagination defaults.  
- Do not drop response fields (`creator`, `expenses_count`) without an explicit API versioning / slim-contract decision.  
- Do not add Redis caching unless product accepts stale totals.

## Next step (when approved)

Add a single migration for the P0 indexes + a tiny `ExpenseBranchScope` request cache; re-benchmark with larger data / staging `EXPLAIN ANALYZE`.
