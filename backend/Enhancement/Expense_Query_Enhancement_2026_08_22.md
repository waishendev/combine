# Expense / Expense Categories — Query Enhancement (2026-08-22)

Enhancement id: `expense-query-enhancement-v1`

## New APIs (DONE)

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/expenses/overview` | CRM `/expenses` first paint (list + active categories) |
| GET | `/api/expenses/query` | CRM `/expenses` pagination / month / category filter |
| GET | `/api/expense-categories/query` | CRM `/expense-categories` list (keeps `expenses_count`) |

Marked in `routes/api.php` between `// NEW ENHANCEMENT` … `// END NEW ENHANCEMENT`.

Legacy list GETs kept as `// OLD QUERY` (`/expenses`, `/expense-categories`). Mutations/export unchanged.

## What changed

### P0 — Indexes (migration `2026_08_22_000100_add_expense_query_enhancement_indexes.php`)

- `expenses (store_location_id, expense_date DESC, id DESC) WHERE deleted_at IS NULL`
- `expenses (store_location_id, expense_category_id, expense_date DESC, id DESC) WHERE deleted_at IS NULL`
- `expenses (expense_category_id) WHERE deleted_at IS NULL`
- `expense_categories (store_location_id, sort_order, name)`
- `expense_categories (store_location_id, is_active, sort_order)`

### P1 — Request memo for `ExpenseBranchScope::fromRequest`

Same pattern as `ReportBranchScope` — one authorize / accessible-branch lookup per HTTP request.

### P2 — New query assembly

- Expenses list: **one** filtered scan with `COUNT(*) OVER()` + `SUM(amount) OVER()` (replaces separate SUM + COUNT + SELECT).
- Overview categories: **no** `withCount` (dropdown unused).
- Categories page query: still `withCount` for branch-edit lock.
- List payload omits unused `creator` eager load (CRM table never showed it).

## CRM wiring

- `ExpensesPage` → `/expenses/overview` first paint; `/expenses/query` after; overview again after category create.
- `ExpenseCategoriesPage` → `/expense-categories/query`.

## Local bench (after)

| Call | Queries | Notes |
|------|---------|-------|
| overview (was 2 APIs ≈ 13 q) | **8** | Single request + scope memo + no dropdown withCount |
| expenses/query | 6 | Window aggregate (no separate sum/count) |
| categories/query | 5 | Same shape as legacy with expenses_count |

## Controller

`App\Http\Controllers\ExpenseQueryEnhancementController`
