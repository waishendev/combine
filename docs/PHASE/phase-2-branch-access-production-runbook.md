# Phase 2 Branch Access Production Runbook

This document is the production operator checklist. For the Phase 2 design, completed work, test scope, and the reason this deployment step is required, see [`phase-2-branch-access.md`](phase-2-branch-access.md).

## Production sequence

### 1. Confirm the production Branch code

Run this against production before the backfill and replace `PNG` in the commands below with the actual existing immutable Branch code:

```sql
SELECT id, name, code, is_active
FROM store_locations;
```

### 2. Run schema migration

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate --force
```

If the Phase 1 production rollout has not already run its setting seeder, run it once with Laravel's production flag:

```bash
php artisan db:seed --class=BranchLimitSettingSeeder --force
```

`BranchLimitSettingSeeder` belongs to the Phase 1 Branch capacity foundation and uses `firstOrCreate`, so an existing setting is preserved. It is separate from the Phase 2 admin-to-Branch backfill.

### 3. Preview the backfill

```bash
php artisan branch-access:backfill --store-code=PNG --dry-run
```

### 4. Execute the production backfill

```bash
php artisan branch-access:backfill --store-code=PNG --force
```

Do not run `BranchAccessPermissionSeeder` separately. The non-dry-run `branch-access:backfill` command invokes it automatically before assigning users. That baseline permission setup grants `branch_access.view` and `branch_access.assign` to `infra_core_x1`.

In production, do not use `php artisan branch-access:backfill --store-code=PNG` without `--force`; the command will refuse to write. `--force` is unnecessary for `--dry-run` because preview mode performs no writes.

### 5. Verify assignments

Use the Artisan command summary and, if needed, verify pivot rows directly:

```sql
SELECT u.id, u.email, sl.code, sl.name
FROM users u
JOIN store_location_user slu ON slu.user_id = u.id
JOIN store_locations sl ON sl.id = slu.store_location_id
ORDER BY u.id, sl.code;
```

### 6. Enable Branch assignment for normal `superAdmin`

First, give the normal application `superAdmin` role access to the Branch assignment controls:

```bash
php artisan db:seed --class=SuperAdminBranchAccessPermissionSeeder --force
```

This seeder is additive and idempotent. It creates the two Branch access permissions only if they are missing and attaches only `branch_access.view` and `branch_access.assign` to the existing role named `superAdmin`. It does not create or modify users, Branch assignments, roles, or business records. If the `superAdmin` role is missing, it prints a warning and assigns nothing.

After running the seeder, sign out and sign back in (or refresh the authenticated session) so the frontend receives the updated permission list. A `superAdmin` assigned only to Branch 1 will see only Branch 1 in the Create/Edit Admin checklist. The API also rejects attempts to submit any Branch outside that user's own assignments, so this restriction does not rely on the UI.

Optionally verify the permission rows:

```sql
SELECT r.name AS role_name, p.slug
FROM roles r
JOIN permission_role pr ON pr.role_id = r.id
JOIN permissions p ON p.id = pr.permission_id
WHERE r.name = 'superAdmin'
  AND p.slug IN ('branch_access.view', 'branch_access.assign')
ORDER BY p.slug;
```

The following legacy rollout correction is optional and is **not** appropriate when a `superAdmin` must remain limited to Branch 1. Use it only if the business decision is that every existing normal `superAdmin` should receive every Branch that is **currently active**. Preview and then execute:

```bash
php artisan branch-access:backfill --all-active-super-admins --dry-run
php artisan branch-access:backfill --all-active-super-admins --force
```

This mode is additive and idempotent: it preserves every existing assignment and inserts only missing `store_location_user` pairs. It excludes inactive Branches, creates no StoreLocations, and skips any user who also has the `infra_core_x1` platform role. The active Branch IDs are snapshotted only when the command runs. A Branch created or activated later is **not** automatically accessible to normal `superAdmin` users and must be assigned explicitly through Admin Management. This is not a bypass; `infra_core_x1` remains the only permanent all-Branch bypass.

## Safety notes

- `--store-code` is required and must match an existing active `store_locations.code` exactly.
- The command does not read `DEFAULT_STORE_LOCATION_CODE` from `.env` for production backfill.
- The command never creates a Branch and never falls back to another Branch.
- The command does not modify Orders, Bookings, POS, Products, Inventory, Reports, or other business records.
- The command may be run repeatedly safely; it only assigns eligible users who currently have no Branch assignments.
- Only Platform Super Admin users with the `infra_core_x1` role receive no pivot rows because they rely on centralized bypass access. Application Super Admin and Owner roles remain explicitly assignment-scoped.
