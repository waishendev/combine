# CRM Header Branch Context completion audit

This is a Phase 2/5/9 completion audit, not a new phase. It applies the existing global-identity, assignment-pivot, and persisted-transaction rules and adds no tenancy or guessed ownership.

## Final semantic decisions

| Page / area | Classification | Final behavior |
| --- | --- | --- |
| Staffs | Global identity + Branch assignment filter | Specific uses `staff_store_location`. All is the union of Staff assigned to the caller's active accessible Branches; `infra_core_x1` retains the platform-wide bypass. Staff identities are never duplicated. |
| Admins | Global identity + Branch assignment filter | Specific uses `store_location_user`; an authorized system-admin viewer also sees `infra_core_x1` users because their access is the deliberate pivot-free bypass. All is assignment-accessible for normal Admins and platform-wide for the bypass. |
| Permissions | Global by design | Security definitions do not react to Header Branch. |
| Permission Groups | Global by design | Security grouping does not react to Header Branch. |
| Roles | Global by design | Roles are permission templates. Branch authorization remains a separate User/StoreLocation assignment. |
| Commission Tiers | Global by design | Current tier calculation selects one tier by commission `type` and company-wide monthly Staff sales. A Branch-specific tier alone would be incoherent because `staff_monthly_sales` is also unique by type/staff/year/month and aggregates earning transactions across Branches. Branch-specific commission policy would therefore require a separately approved redesign of both earning aggregation and snapshot identity, not merely a nullable column on the tier table. |
| Ecommerce commission snapshots | Data-model limitation | Existing monthly snapshots do not persist deterministic earning Branch. They must not be filtered using current Staff assignment or represented as accurate Branch snapshots. Transaction-attributed commission reports must instead follow persisted Order/Booking Branch. |

## Migration and operational-history audit

The repository-root `New Feature` run sheet records that its listed migration and backfill sequence was run on **2026-08-08**. That is operational evidence, not a substitute for querying the deployed database.

| Area | Existing migration | Existing backfill / command | Expected migrated state after recorded run | Current gap classification |
| --- | --- | --- | --- | --- |
| Admin assignment | `2026_08_05_000001_create_store_location_user_table.php` | `branch-access:backfill --store-code=PNG --dry-run|--force` | Every eligible non-`infra_core_x1` legacy User that previously had no assignment has one PNG pivot; existing assignments are preserved; platform users remain deliberately pivot-free. | **COMPLETE per run sheet; verify live counts** |
| Staff assignment | `2027_01_07_000001_create_booking_branch_assignment_tables.php` | `booking-branch:backfill --store-code=PNG --dry-run|--force` | Every legacy Staff and Booking Service has PNG assignment; existing other-Branch assignments remain. | **COMPLETE per run sheet; verify live counts** |
| Booking operational records | later columns on schedules/time-off/blocks | same `booking-branch:backfill` | Deterministic NULL operational rows for PNG-assigned Staff are attributed; approved Leave NULL rows and unresolved Staff rows remain intentionally global/unresolved. | **PARTIAL BY DESIGN** |
| Commission tiers | `2026_12_15_000110_create_staff_booking_commission_tables.php` | none required | Six seeded global tiers, subsequently managed as global definitions. | **GLOBAL BY DESIGN** |
| Commission monthly snapshots | same migration plus snapshot/status enhancement | recalculation commands, not Branch backfills | Global monthly snapshots remain without Branch identity. | **DATA MODEL LIMITATION** |
| POS / cash shift | POS Branch migrations | `pos-branch:backfill --store-code=PNG --dry-run|--force` | Deterministic legacy POS data is PNG-attributed; unresolved NULL stays explicit. | **COMPLETE per run sheet; NULL requires live verification** |
| Orders / Bookings and other transactions | Phase 4 transaction migrations | `branch-transactions:backfill --store-code=PNG --dry-run|--force` | Deterministic legacy transactions are PNG-attributed; unresolved rows stay NULL rather than guessed. | **COMPLETE per run sheet; NULL requires live verification** |

No new Staff, Admin, or Commission Tier backfill command is added. Existing commands already implement explicit Store code, dry-run review, idempotent pivot insertion, preservation of existing assignments, and the `infra_core_x1` exclusion. Duplicating them would create competing operational procedures.

## Read-only live-data verification

The source container has the PostgreSQL connection configuration but no reachable database client/PDO PostgreSQL driver and no Composer runtime, so deployed row counts cannot be truthfully recorded here. Run the existing dry-runs against the intended environment first:

```bash
php artisan branch-access:backfill --store-code=PNG --dry-run
php artisan booking-branch:backfill --store-code=PNG --dry-run
php artisan pos-branch:backfill --store-code=PNG --dry-run
php artisan branch-transactions:backfill --store-code=PNG --dry-run
```

For an independent read-only count audit, use:

```sql
SELECT COUNT(*) AS staff_total,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM staff_store_location ssl WHERE ssl.staff_id = staffs.id)) AS staff_with_assignment,
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM staff_store_location ssl WHERE ssl.staff_id = staffs.id)) AS staff_missing_assignment
FROM staffs;

SELECT COUNT(*) AS user_total,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM store_location_user slu WHERE slu.user_id = users.id)) AS users_with_assignment,
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM store_location_user slu WHERE slu.user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON r.id = ru.role_id WHERE ru.user_id = users.id AND r.name = 'infra_core_x1')) AS users_missing_assignment,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON r.id = ru.role_id WHERE ru.user_id = users.id AND r.name = 'infra_core_x1')) AS platform_bypass_users
FROM users;

SELECT COUNT(*) AS tier_total FROM staff_commission_tiers;
SELECT COUNT(*) AS monthly_snapshot_total FROM staff_monthly_sales;
```

Commission tiers have no missing-Branch count because Branch ownership is not part of their business model. A NULL count must not be fabricated by treating absence of a column as missing data.

## Request and authorization contract

Branch-aware clients send `branch_store_location_id` for a specific Branch and `branch_scope=all` for All. Branch changes reset pagination/data and abort or sequence-guard stale responses. Servers authorize specific IDs through `StoreLocationAccessService`; All derives accessible IDs server-side, and browser-supplied ID lists are never accepted.
