# Phase 9D — Expense Multi-Branch Enhancement

**Classification:** Post-Phase-9 Multi-Branch coverage enhancement<br>
**Scope:** Expense Management only<br>
**Tenant model:** One company with multiple `store_locations`; this is not Multi-Tenancy and is not Phase 10.

## Background

Expense Management was created before the Multi-Branch rollout. Its original migration, `backend/ecommerce_gentlegurl_backend_api/database/migrations/2026_07_22_000001_create_expense_management_tables.php`, created `expenses` and `expense_categories` without Branch ownership. Consequently, historical rows could not be deterministically included in Branch reports.

Phase 9D documents the implementation delivered by commit **`63b4bf1 Add multi-branch expense management`** and adds an explicit production backfill procedure. The schema migration intentionally did not guess a Branch for historical data.

## Implementation

The enhancement is **IMPLEMENTED** as follows:

- nullable `store_location_id` ownership was added to both `expenses` and `expense_categories`, referencing the existing `store_locations` table;
- Expense Category uniqueness changed from company-global name uniqueness to `(store_location_id, name)` uniqueness;
- appropriate `(store_location_id, expense_date)` and `(store_location_id, expense_category_id)` indexes support list, reporting, and category-filter queries;
- the CRM reuses the existing Header Branch Context rather than introducing a second persistent context;
- a Specific Branch automatically supplies the Branch on create, while All Branches requires an explicit accessible Branch selection;
- an Expense Category must be active and belong to the same Branch as its Expense, with backend validation in addition to frontend filtering;
- ownership is locked while editing from a Specific Branch; All Branches permits an explicit authorized ownership correction, with Expense Category revalidation and usage safeguards;
- list, show, create, update, delete/archive, ordering, and export operations use server-side `StoreLocationAccessService` authorization and accessible-Branch query scoping;
- specific-Branch requests exclude legacy `NULL`; All Branches may display those historical records as **Unassigned**;
- Branch-attributed Expenses participate in Branch-specific Profit/Loss/Contribution calculations, while `NULL` remains Unassigned until an operator explicitly backfills it;
- Expense and Category pages invalidate previous rows and suppress stale asynchronous responses when the Header Branch changes; and
- IDOR protection is enforced on the backend: inaccessible Branch records and manually submitted inaccessible Branch IDs are rejected regardless of frontend state.

The implementing schema migration is `backend/ecommerce_gentlegurl_backend_api/database/migrations/2026_08_20_000001_add_store_location_to_expense_management_tables.php`.

## Legacy Data Backfill

The current legacy Gentlegurls Expense Management records are known operationally to belong to the existing **PNG** Branch. That production fact is not encoded as an application default. Run the dedicated operator command explicitly:

```bash
php artisan expense-branch:backfill --store-code=PNG --dry-run
php artisan expense-branch:backfill --store-code=PNG --force
```

The command deliberately:

1. requires `--store-code`; it never reads the Header Branch or `DEFAULT_STORE_LOCATION_CODE`;
2. resolves an already-existing `store_locations.code` and fails if it does not exist;
3. requires exactly one of `--dry-run` or `--force`;
4. counts legacy `NULL` and already-attributed rows separately;
5. audits Expense-to-Category relationships before writing;
6. refuses to proceed if assigning either side to the target would conflict with the other side's existing non-target Branch;
7. updates only `WHERE store_location_id IS NULL`, Categories first and Expenses second, in one transaction;
8. verifies that it introduced no target-related Expense/Category Branch mismatch before commit; and
9. preserves every pre-existing non-`NULL` assignment, making repeat runs idempotent.

`--dry-run` never modifies data. Review its target Branch, row counts, and conflict list before executing `--force`. A conflict requires manual data review; the command neither moves an already-attributed row nor manufactures a replacement Category.

The command is not invoked by migrations, seeders, deployment hooks, or application startup.

## UI Semantics

### Header = Specific Branch

- Lists show only records owned by the selected accessible Branch.
- Legacy `NULL` records are excluded.
- Create automatically uses the Header Branch.
- No duplicate Branch selector is shown.
- Edit/delete remains constrained to that Branch; ownership cannot be moved from this context.
- Expense Category choices are limited to that Branch.

### Header = All Branches

- Lists include records from authenticated accessible Branches, never every database Branch.
- A Branch column distinguishes records.
- Create requires selection from the authenticated accessible Branch dropdown.
- A Branch-owned record cannot be created with `NULL`.
- Expense edit may move ownership to another accessible Branch, but changing Branch clears the old Category selection and requires a Category owned by the target Branch.
- An unused Expense Category may move to another accessible Branch; a Category referenced by any Expense remains read-only and the backend rejects movement rather than moving its Expenses.

### Legacy NULL

- Historical rows may appear as **Unassigned** in All Branches where that view permits historical visibility.
- They never appear in a Specific Branch.
- They are never silently treated as PNG. They become PNG-owned only after the explicit backfill command succeeds.

## Profit/Loss

After attribution, Branch-owned Expenses participate in the selected Branch's Profit/Loss/Contribution calculation. All Branches aggregates Expenses only for authenticated accessible Branches and applies the documented Unassigned history semantics. Legacy `NULL` Expenses remain Unassigned/Global until the operator runs the explicit backfill. Existing Sales, COGS, Refund, and Branch scoping logic is unchanged.

## Testing / Readiness

| Readiness item | Status | Notes |
|---|---|---|
| Expense Multi-Branch schema/API/UI/report behavior | **IMPLEMENTED** | Delivered by commit `63b4bf1`. |
| Explicit legacy PNG backfill command | **IMPLEMENTED** | NULL-only, transactional, conflict-aware, and idempotent. |
| PHP syntax and repository whitespace checks | **STATIC VALIDATION PASSED** | Run on changed operational-support files. |
| Backfill command feature coverage | **AUTOMATED TEST ADDED** | Covers dry-run, force, preservation, idempotency, missing Branch, and both conflict directions. |
| PHPUnit execution in this workspace | **AUTOMATED TEST NOT EXECUTED** | Composer `vendor/autoload.php` is unavailable; CI or deployment validation must execute the added test with a test database. |
| Production data review | **MANUAL QA REQUIRED** | Run dry-run against a recent production snapshot, review all conflicts/counts, take a backup, then run force in a controlled window. |
| CRM workflow verification | **MANUAL QA REQUIRED** | Verify A → B → All switching, create/edit Category filtering, and Profit/Loss totals with representative permissions. |

### Production checklist

1. Confirm the Phase 9D migration has run.
2. Back up `expense_categories` and `expenses` or take a database snapshot.
3. Run the PNG dry-run and retain its output in the deployment record.
4. Resolve every reported conflict; do not use SQL to overwrite attributed Branches without business approval.
5. Run the force command once.
6. Run the dry-run again; both “Legacy NULL rows” counts should be zero for fully reconciled production data.
7. Verify Expense/Category Branch equality and compare Expense and Profit/Loss totals before and after attribution.
8. Perform Header Specific/All manual QA with a restricted Branch administrator.
