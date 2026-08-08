# Phase 5A Booking Branch Foundation — Production Runbook

## Scope and assumptions
Phase 5A adds explicit global Staff/Booking Service many-to-many Branch assignments. It does **not** branch schedules, time off, leave, blocks, collision policy, commissions, POS, inventory, or service commercial configuration. Fresh installs use `config('multi_branch.fresh_install_store_code')` (`DEFAULT_STORE_LOCATION_CODE`, default `PNG`). Production backfill never reads that default: operators must provide a code.

## Deploy and migrate
1. Deploy backend and both clients together (public APIs require Branch context).
2. Run `php artisan migrate`.
3. Dry-run: `php artisan booking-branch:backfill --store-code=PNG --dry-run`.
4. After approval only, run `php artisan booking-branch:backfill --store-code=PNG --force` (do **not** automate it).

Replace `PNG` with the approved existing active Branch code. The command reports Staff and Service total/already assigned/missing counts separately, performs zero dry-run writes, is idempotent, and never creates Branches, removes assignments, or assumes ID 1.

## Reconciliation
```sql
SELECT COUNT(*) AS staff_total FROM staffs;
SELECT store_location_id, COUNT(*) AS staff_assigned FROM staff_store_location GROUP BY store_location_id;
SELECT COUNT(*) AS service_total FROM booking_services;
SELECT store_location_id, COUNT(*) AS services_assigned FROM booking_service_store_location GROUP BY store_location_id;
SELECT s.id, s.name FROM staffs s LEFT JOIN staff_store_location x ON x.staff_id=s.id WHERE x.staff_id IS NULL;
SELECT s.id, s.name FROM booking_services s LEFT JOIN booking_service_store_location x ON x.booking_service_id=s.id WHERE x.booking_service_id IS NULL;
```
Unassigned Staff and Services are intentionally unavailable in public Branch booking.

## Rollback
Roll application code and clients back first. Back up both pivots, then `php artisan migrate:rollback --step=1`; this drops only assignment tables. Global Staff, Services, historical Bookings, and `bookings.store_location_id` remain unchanged.

## Known limitations before Phase 5B
Schedules, leave/time off, booking blocks, and collision checks remain global. The business must decide whether simultaneous cross-Branch work is possible and whether those rules become Branch-specific. Prices, duration, deposits, rules, questions, and media remain global.
