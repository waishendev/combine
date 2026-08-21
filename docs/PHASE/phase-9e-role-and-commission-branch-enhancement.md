# Phase 9E — Role and Commission Branch enhancement

> **Completion pass:** Foundation commit `f6ef7e4afd93d4626c8a0410df4335fffb6c4c5c` is completed by the transaction-derived calculation, report authorization, observer propagation, and explicit legacy reconciliation work described below. This remains Phase 9E.

## Decision and pre-implementation audit

The Phase 0 document classified RBAC and commission policy as global for the first multi-Branch release. Phase 9E deliberately revisits that decision; it is not Phase 10 and introduces neither tenancy nor `tenant_id`.

The executable audit found globally unique `roles.name`, `permission_role` for the Role-to-Permission many-to-many relationship, and `role_user` allowing multiple Roles per User. Admin create/update synchronized that global pivot and assigned Branch access separately through `store_location_user`. `infra_core_x1` and `is_system` protect platform administration. Seeded and production Roles cannot be deterministically classified solely from their names, so migration-time attribution is unsafe.

Commission tiers were unique by `(type,min_sales)`. `StaffCommissionService` aggregated order item and package staff splits into `staff_monthly_sales`, whose identity was `(type,staff_id,year,month)`, then selected the highest qualifying global tier. Booking incremental updates used completed/paid Bookings; ecommerce recalculation used paid/completed Orders. Snapshot tier values and freeze/reopen logs existed, but none persisted Branch. Orders and Bookings now carry the immutable earning `store_location_id` from earlier phases.

## Role model

`roles.store_location_id` is nullable direct ownership. This was selected instead of a Role-to-Branch pivot because two Branches must be able to independently edit a Role named “Manager” without permission changes leaking between them. A non-NULL Role is operational and owned by exactly one Branch. NULL is reserved for protected system Roles and unresolved legacy records; it is never interpreted as the current or first Branch. Permission and Permission Group tables and `permission_role` remain global definitions.

Branch Role names are unique per Branch (case-insensitive on PostgreSQL), so the same name is valid in different Branches. Existing NULL names retain global uniqueness. No automatic migration or seeder assigns legacy Roles to PNG.

`role_user_store_location(user_id,store_location_id,role_id)` represents operational assignments. A User with multiple Branches receives an explicit Role per Branch. Assignment validates that a Role's owner is among the User's assigned Branches; it never moves Branch access. `role_user` remains only for global/system legacy assignments. The platform bypass remains a global `infra_core_x1` Role and is never converted into an ordinary Branch assignment.

## Header Branch Context and authorization

Role and tier list endpoints resolve `branch_store_location_id` through `StoreLocationAccessService`. A specific Branch excludes NULL legacy rows. All Branches derives accessible IDs server-side and may display Global/Unassigned rows for reconciliation. Create in a specific context supplies that Branch automatically; All requires an explicit accessible Branch. Direct show/edit/update/delete calls authorize the persisted owner, preventing IDOR even when an ID is guessed. Permission selection remains global and delegation checks are unchanged.

## Commission model and attribution

`staff_commission_tiers.store_location_id` owns configuration. Threshold uniqueness and lookup are `(store_location_id,type,min_sales)`, allowing identical thresholds across Branches. With minimum-threshold tiers there is no stored upper bound: ordering defines the effective ranges, and duplicate minimums in one Branch/type are rejected.

`staff_monthly_sales.store_location_id` changes new snapshot identity to `(store_location_id,type,staff_id,year,month)`. `staff_commission_logs` also persists Branch. Tier selection uses the snapshot's Branch. Booking incremental calculation uses `bookings.store_location_id`; a Booking without persisted Branch is unsupported and is not inferred from Staff. Order-backed calculations must use `orders.store_location_id`, including package sales attached to the Order. Changing a Staff member's current Branch assignment never rewrites the earning Branch.

Existing tiers, monthly snapshots, and logs initially remain NULL Global/Unassigned. Migration does not recalculate, mutate, or attribute history. The explicit `commission-branch:reconcile` command derives evidence from persisted Booking and Order Branches, rebuilds deterministic per-Branch snapshots, splits proven cross-Branch aggregates, carries a single deterministic Branch to logs, and preserves unsupported rows as NULL. Current Staff assignment is never a fallback.

Order product splits and POS package splits are grouped using `orders.store_location_id`. Booking lines use `bookings.store_location_id`. Recalculation enumerates `(Branch, Staff)` pairs per month, and all `firstOrCreate`, tier selection, freeze/reopen, logs, and API scopes retain the Branch dimension. Missing Branch tiers produce an explicit configuration error; there is no global or cross-Branch fallback.

## Operator reconciliation

Run review first, then force only during a controlled maintenance window:

```bash
php artisan role-branch:reconcile --store-code=PNG --dry-run
php artisan role-branch:reconcile --store-code=PNG --force
php artisan commission-branch:reconcile --store-code=PNG --dry-run
php artisan commission-branch:reconcile --store-code=PNG --force
```

Exactly one mode and an exact active Branch code are mandatory. Dry-run writes nothing and prints `DRY RUN ONLY — NO DATA CHANGED`, candidate/conflict/unresolved counts, Branch splits, and projected actions. Force re-audits under row locks in a retrying database transaction. Any tier, Role-name, snapshot identity, or missing-tier conflict rolls back the domain operation.

Role reconciliation treats a non-system NULL Role as deterministic only when it has legacy assignments and every assigned User already has target-Branch access. It moves those assignments to `role_user_store_location`. Unassigned Roles, mixed-access Roles, `is_system`, and `infra_core_x1` stay global/ambiguous.

Commission reconciliation assigns legacy tier policy to the approved target only when target thresholds do not conflict. A legacy snapshot is rebuilt only when persisted earning rows prove one or more Branches; multi-Branch evidence creates separate snapshots. Logs inherit Branch only for a single proven Branch. Rows without evidence remain NULL. Output reports pre/post earning and commission totals; tier-driven commission deltas are visible rather than normalized away.

## UI behavior

Both CRM workspaces subscribe to Header Branch Context, abort stale requests during switching, reset pagination, and refetch. Specific Branch creation has no duplicate selector. In All Branches an explicit accessible Branch is selected before opening create; commission tiers show a Branch column. Legacy rows are labelled Global/Unassigned where displayed.

## Migration and production safety

The new Phase 9E migration only adds nullable FKs and indexes, preserves all data, drops only superseded global uniqueness, and uses PostgreSQL partial expression indexes without generated columns. Deploy code and migration together. Take a backup and inspect NULL counts before enabling Branch Role/tier creation. Do not manually coerce NULL to PNG.

## QA matrix

Automated and manual verification should cover A/B/C list isolation, accessible All, same-name Roles and same-threshold tiers across Branches, in-Branch duplicate rejection, all direct endpoint IDOR paths, system Role protection, global Permission visibility, cross-Branch Admin assignment rejection, per-Branch order/booking/package aggregation, Staff reassignment history, frozen snapshots, and NULL legacy display.

Manual QA remains necessary for the Admin editor's multi-Branch Role selection, booking/ecommerce monthly freeze/reopen/report screens, CSV exports outside the commission endpoints, package attribution, PostgreSQL migration on a production-sized clone, and review of both reconciliation dry runs. Reconciliation is intentionally never automatic.

## Production checklist

1. Back up Roles, RBAC pivots, tiers, monthly snapshots, logs, Orders, Bookings, and package purchases.
2. Deploy the Phase 9E migration and completion code together.
3. Run both PNG dry-runs; archive output and resolve every conflict.
4. Compare per-Staff/type/month earning and commission totals, including reported tier deltas.
5. Run force commands in a maintenance window, then repeat dry-runs to prove idempotency.
6. Exercise A/B Header switching, direct-ID denial, freeze/reopen, exports, and package sales.

## Final targeted audit

1. Permission definitions and Permission Groups remain global.
2. Operational Roles are Branch-owned and names may repeat across Branches.
3. Multi-Branch Admin assignments are rows in `role_user_store_location`; system/global assignments remain in `role_user`.
4. `infra_core_x1` and `is_system` remain protected platform concepts.
5. Commission tiers and new monthly/log identity carry Branch.
6. Tier selection reads the persisted snapshot Branch; Booking incremental attribution reads persisted Booking Branch.
7. NULL historical snapshots remain Global/Unassigned and no Staff assignment is used to guess Branch.
8. Lists and direct mutation/detail endpoints authorize through `StoreLocationAccessService`.
9. Explicit Role and Commission reconciliation commands exist; neither runs from migration, seeding, startup, or deployment.
