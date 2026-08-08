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

# Phase 5B Branch-aware scheduling

## Semantics

A Staff Branch assignment means the Staff **may** work at the Branch. An active `booking_staff_schedules` row means the Staff actually works at its one `store_location_id` during that weekly day/time range. For example, Monday 10:00–14:00 at Branch A and Monday 15:00–19:00 at Branch B is valid. Time ranges for the same Staff/day may not overlap across any Branch; no travel or Branch-switch buffer is inferred.

Bookings continue to collide globally by Staff and time, regardless of `bookings.store_location_id`. Availability is Branch-specific and requires the selected Branch's schedule, operational time-off, and blocks while retaining global Staff Leave and global Booking collision behavior.

`BookingStaffTimeoff` is shared by two current code paths. Rows linked from `booking_leave_requests.approved_timeoff_id` remain Staff-global Leave artifacts and intentionally retain `store_location_id = NULL`. Non-leave operational time-off is Branch-specific. The current CRM has no independent operational Time-Off CRUD page; Phase 5B therefore does not invent one. Leave UI and approval semantics remain unchanged.

`BookingBlock` scopes (`STORE` and `STAFF`) are operational booking blocks and now require one real Branch. `STORE` blocks everyone at that Branch; `STAFF` blocks the selected Staff only at that Branch. “All Branches” remains a viewing context and is never persisted.

## Migration and rollout

```bash
php artisan migrate
php artisan booking-branch:backfill --store-code=PNG --dry-run
# after reconciliation only; DO NOT automate:
php artisan booking-branch:backfill --store-code=PNG --force
```

The command reports Schedule, operational Time-Off, Block, and unresolved counts separately. It only fills NULL attribution when the Staff is already assigned to the operator-selected Branch, never overwrites non-NULL values, never attributes leave-generated time-off, and leaves unresolved records unchanged.

## Legacy NULL compatibility

During the bounded migration window, NULL Schedule rows are not used by Branch-specific public slot generation. NULL Time-Off and Block rows remain global availability blockers so deployment does not accidentally reopen legacy blocked time; the backfill removes this compatibility dependency for resolvable operational rows. Leave-linked NULL Time-Off remains global by design through the Leave relationship. After reconciliation, remove the legacy NULL fallback for operational Time-Off/Blocks in a follow-up hardening migration; do not reinterpret NULL as a Branch.

## Reconciliation

```sql
SELECT store_location_id, COUNT(*) FROM booking_staff_schedules GROUP BY store_location_id;
SELECT store_location_id, COUNT(*) FROM booking_staff_timeoffs GROUP BY store_location_id;
SELECT store_location_id, scope, COUNT(*) FROM booking_blocks GROUP BY store_location_id, scope;
SELECT id, staff_id FROM booking_staff_schedules WHERE store_location_id IS NULL;
SELECT t.id, t.staff_id FROM booking_staff_timeoffs t LEFT JOIN booking_leave_requests l ON l.approved_timeoff_id=t.id WHERE t.store_location_id IS NULL AND l.id IS NULL;
SELECT id, scope, staff_id FROM booking_blocks WHERE store_location_id IS NULL;
SELECT a.staff_id, a.day_of_week, a.id, b.id FROM booking_staff_schedules a JOIN booking_staff_schedules b ON a.staff_id=b.staff_id AND a.day_of_week=b.day_of_week AND a.id<b.id AND a.start_time<b.end_time AND a.end_time>b.start_time WHERE a.is_active=1 AND b.is_active=1;
```

## Rollback and deferrals

Roll application clients back first. Back up the three tables, then roll back the Phase 5B migration; `nullOnDelete` protects historical rows if a Branch is deleted. Rolling back removes only the three Branch foreign keys/indexes and does not alter Bookings or Phase 5A pivots.

Deferred: travel/distance calculations, transfer buffers, maximum Branches/day, rotation templates, temporary transfers, approvals, automatic relocation, products/inventory/POS conversion, payment configuration, packages/vouchers/points, full reporting conversion, Phase 6, organizations, and multi-tenancy. Service price, duration, deposit, buffer, rules, and commission remain global.
