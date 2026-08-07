# Phase 2: Admin-to-Branch Access Foundation

## Why Phase 2 is required

Production already contains users and an existing default Branch. The Phase 2 migration creates the new `store_location_user` relationship table, but intentionally does not guess which existing Branch should be assigned and does not modify data inside a schema migration. Therefore, production needs a separate, explicit backfill after migration.

The operator supplies the immutable code of the existing active Branch. This makes the selected Branch reviewable and prevents an accidental fallback to the first row, a numeric ID, or an environment default.

## What Phase 2 completed

- Added the `store_location_user` many-to-many relationship between users and StoreLocations, including timestamps, foreign keys, and duplicate-assignment protection.
- Added centralized backend Branch access checks. Platform Super Admin users use bypass access and do not need pivot rows.
- Added `GET /api/me/store-locations` for the authenticated user's accessible Branches.
- Added Branch assignment controls and backend validation to CRM Admin create/edit flows.
- Added the idempotent `branch_access.view` and `branch_access.assign` permissions for the configured Platform Super Admin role.
- Added a reusable backfill service and the production-safe `branch-access:backfill` Artisan command.
- Kept existing Orders, Bookings, POS, Products, Inventory, Reports, and other business modules unchanged and unfiltered.

## Why the production commands must be run

The two commands have different responsibilities:

1. `php artisan migrate --force` creates the `store_location_user` pivot schema in production.
2. `php artisan branch-access:backfill --store-code=PNG --force` ensures the Phase 2 permissions exist and assigns only existing, eligible, non-Platform-Super-Admin users who currently have no Branch assignment.

Running only the migration leaves existing normal admins without an explicit Branch assignment. Running only the backfill before the migration cannot work because the pivot table does not exist.

Replace `PNG` with the exact code of the existing active production Branch. The command never creates a Branch, never changes existing assignments, and never modifies business transaction records.

## What to test before writing production data

First confirm the Branch code in `store_locations`, run the migration, and preview the exact backfill result:

```bash
php artisan branch-access:backfill --store-code=PNG --dry-run
```

The preview must show the intended Branch and counts for eligible users, new assignments, users already assigned, and skipped Platform Super Admin users. Dry-run performs no permission or pivot writes.

After reviewing the preview, execute:

```bash
php artisan branch-access:backfill --store-code=PNG --force
```

Verify that normal admins without prior assignments received the selected Branch, existing assignments remained unchanged, and Platform Super Admin users received no pivot rows. Re-running the command should report no new assignments.

The complete SQL checks and command order are in the [production runbook](phase-2-branch-access-production-runbook.md).

## Fresh installs / other customers

`php artisan migrate:fresh --seed` remains supported. `DatabaseSeeder` creates roles and Platform Super Admin users, ensures Branch access permissions, creates the initial StoreLocation through `StoreLocationsSeederReal`, and then runs the fresh-install Branch access backfill.

## Deferred to Phase 3 or later

Phase 2 does not add a Header Branch Selector, selected-Branch persistence, or Branch filtering/attribution for Orders, Bookings, POS, Products, Inventory, Reports, Staff, Services, or other business modules.
