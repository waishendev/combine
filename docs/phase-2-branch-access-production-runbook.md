# Phase 2 Branch Access Production Runbook

Phase 2 adds admin-to-Branch access assignment without filtering existing business modules.

## Production command

Run this after deploying the Phase 2 code:

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate --force
php artisan db:seed --class=BranchAccessProductionSeeder --force
```

## Default Branch resolution

The production seeder is idempotent. It assigns existing non-Platform-Super-Admin users to one default active Branch in `store_location_user`.

Resolution order:

1. Active `store_locations.code` matching `DEFAULT_STORE_LOCATION_CODE`.
2. If no configured-code match exists, exactly one active `store_locations` row.
3. If neither rule is safe, the seeder stops with an error instead of guessing.

Set this before running the seeder when production has multiple active Branches:

```bash
DEFAULT_STORE_LOCATION_CODE=PNG
```

Platform Super Admin users with `infra_core_x1` / configured super-admin role are not backfilled into the pivot because they bypass branch rows by policy.

## Fresh installs / other customers

`php artisan migrate:fresh --seed` remains supported. The normal `DatabaseSeeder` runs the permission seeder and default Branch backfill after the real StoreLocation seeder creates the installation Branch.
