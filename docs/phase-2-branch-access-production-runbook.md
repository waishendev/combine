# Phase 2 Branch Access Production Runbook

Phase 2 adds admin-to-Branch access assignment without filtering existing business modules.

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

### 3. Preview the backfill

```bash
php artisan branch-access:backfill --store-code=PNG --dry-run
```

### 4. Execute the production backfill

```bash
php artisan branch-access:backfill --store-code=PNG --force
```

### 5. Verify assignments

Use the Artisan command summary and, if needed, verify pivot rows directly:

```sql
SELECT u.id, u.email, sl.code, sl.name
FROM users u
JOIN store_location_user slu ON slu.user_id = u.id
JOIN store_locations sl ON sl.id = slu.store_location_id
ORDER BY u.id, sl.code;
```

## Safety notes

- `--store-code` is required and must match an existing active `store_locations.code` exactly.
- The command does not read `DEFAULT_STORE_LOCATION_CODE` from `.env` for production backfill.
- The command never creates a Branch and never falls back to another Branch.
- The command does not modify Orders, Bookings, POS, Products, Inventory, Reports, or other business records.
- The command may be run repeatedly safely; it only assigns eligible users who currently have no Branch assignments.
- Platform Super Admin users with `infra_core_x1` / configured super-admin role receive no pivot rows because they rely on centralized bypass access.

## Fresh installs / other customers

`php artisan migrate:fresh --seed` remains supported. The normal `DatabaseSeeder` creates roles and Platform Super Admin first, runs Branch access permission setup, creates the initial StoreLocation through `StoreLocationsSeederReal`, then runs the fresh-install Branch access backfill for the seeded default Branch.
