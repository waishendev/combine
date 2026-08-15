# Gentlegurls multi-branch impact analysis

> **Phase 5A implementation refinement (2026-08-08):** global `Staff` and `BookingService` identities use explicit `staff_store_location` and `booking_service_store_location` pivots. Public discovery and cart submission require explicit Branch assignment plus existing service/staff eligibility. Schedules, time off, leave, blocks, collisions, commissions, and commercial fields remain unchanged pending Phase 5B. See `phase-5a-booking-branch-runbook.md`.

> **Phase 5B implementation refinement (2026-08-08):** weekly Staff schedules and operational Booking Blocks are Branch-specific; schedule overlap and Booking collision remain global by Staff/time. `BookingStaffTimeoff` is also used as an approved Leave artifact, so leave-linked NULL rows remain Staff-global while non-leave operational rows can be Branch-attributed. Legacy NULL operational blockers are temporarily honored globally during reconciliation, but NULL schedules never create Branch availability.

**Status:** Phase 0 architecture audit and planning only  
**Audit date:** 2026-08-02  
**Projects inspected:** Laravel backend, Next.js CRM, Next.js ecommerce shop, Next.js booking shop  
**Decision boundary:** one company with multiple branches; this is **not** tenant isolation.

## 1. Executive decision record

1. `store_locations` is the branch master. Keep the backend vocabulary `store_locations`, `store_location_id`, and `StoreLocation`; CRM may say **Branch**. Do not create `branches`.
2. Extend the master with `is_pickup_available`, `is_booking_available`, `is_pos_available`, and optionally `sort_order`. IDs never change; codes should become immutable after creation; names remain editable.
3. Branches referenced by business data must never be hard-deleted. Deactivation is the normal lifecycle. Existing image deletion may remain, but `StoreLocationController::destroy` must ultimately be removed/forbidden.
4. Retain shared RBAC. Add branch access orthogonally: **effective access = action permission AND allowed store location**. Do not generate branch-named permissions and do not introduce per-branch roles in v1.
5. A user/location many-to-many pivot is required. Safest conventional name is `store_location_user` because the existing RBAC pivot is `role_user` and Eloquent models the administrator as `User`. Columns: `user_id`, `store_location_id`, timestamps, unique pair; both FKs should `cascadeOnDelete` only on the pivot. A Super Admin bypass may see all locations, but it must be explicit policy logic rather than synthetic pivot rows.
6. `orders.pickup_store_id` means pickup destination only. Add a separate `store_location_id` when an order has a sales/fulfilment branch (mandatory for POS, normally selected/derived for pickup, and owner-defined for delivery). Never silently reinterpret the existing field.
7. Keep global catalog identity separate from branch configuration. Use configuration/inventory pivots rather than cloning products, variants, services, vouchers, or gateways per branch.
8. Seeders must create at most the initial/default installation branch. Production branch creation belongs to a protected Super Admin page.

## 2. Audit method and limitations

The audit read models, controllers, routes, migrations, seeders, tests, API clients, application pages, shared components, authentication state, and direct text references in all four projects. “Likely affected” below means a file owns a query, contract, UI, or workflow that will require branch input/output; it does not assert that all changes belong in the same phase. Generated artifacts, dependencies, storage, lockfile text, Postman exports, and scratch `.txt/.ini` files are excluded from implementation scope unless explicitly listed.

The repository contains migrations dated beyond the audit date. Their current checked-in schema was still audited; deployment order must follow migration filenames, not calendar assumptions. Automated backend coverage is currently sparse (principally unit tests plus `ReturnTrackingTest`), and no existing branch-authorization suite was found.

## 3. Current `store_locations` architecture and complete direct usage

### 3.1 Schema and model

`2025_11_28_000009_create_store_locations_table.php` creates: immutable bigint `id`, unique `code`, name/address/phone, default Malaysia country, `is_active`, and timestamps. `2026_01_01_000003_add_opening_hours_to_store_locations_table.php` adds nullable JSON `opening_hours`. `StoreLocation` casts active/opening hours and owns ordered `StoreLocationImage` records.

Related schema:

| Table | Current relationship | Deletion behavior | Finding |
|---|---|---|---|
| `store_location_images` | required `store_location_id` | cascade | Correct for dependent media only. |
| `page_reviews` | nullable `store_location_id` | `nullOnDelete` | Historical association would be erased; change policy before enabling branch deletion (prefer restrict/no delete). |
| `orders` | nullable `pickup_store_id` | `nullOnDelete` | Pickup history would be erased; keep the FK non-destructive and prevent master deletion. |
| `bank_accounts` | optional location scoping is present in model/migration/controllers/UI | inspect/retain as partial support | This is existing branch-configurable payment support and should be generalized carefully. |

### 3.2 Current backend behavior

`StoreLocationController` already provides paginated filters, create/show/update, up to six ordered images, active state, and **hard delete**. Update currently permits changing `code`. Routes expose public active store locations and authenticated CRUD (route middleware must be tightened to Super Admin/branch-management permission). Public checkout validates pickup IDs and loads store data, but current stock is global. `Order` exposes `pickupStore`; order serializers/controllers/history/payment flows include pickup data. Page reviews can associate a store. Bank accounts already contain location-oriented filtering/configuration, a reusable precedent but not an authorization layer.

Complete direct backend source/schema/seed usage found by the audit:

- Controllers: `app/Http/Controllers/StoreLocationController.php`; `Booking/PaymentController.php`; `Booking/PaymentLinkController.php`; `Ecommerce/{BankAccountController,OrderController,PosController,PublicBankAccountController,PublicCheckoutController,PublicCustomerWalletController,PublicOrderHistoryController,PublicPageReviewController,PublicPaymentMethodController}.php`; legacy `app/Http/Controllers/order.txt` (do not implement against it).
- Models: `app/Models/BankAccount.php`; `app/Models/Ecommerce/{Order,PageReview,StoreLocation,StoreLocationImage}.php`.
- Migrations: `2025_11_28_000009_create_store_locations_table.php`, `2025_11_28_000011_create_orders_table.php`, `2025_12_31_000200_create_bank_accounts_table.php`, `2026_01_01_000002_create_page_reviews_table.php`, `2026_01_01_000003_add_opening_hours_to_store_locations_table.php`, `2026_01_01_000004_create_store_location_images_table.php`.
- Seeders: `BankAccountSeeder.php`, `FrontendTestDataSeeder.php`, `SelfPickupCompletedOrderSeeder.php`, `StoreLocationsSeederReal.php`, `realdata.php`.
- Route: `routes/api.php`. API documentation artifacts also mention these contracts but are not runtime code.
- No dedicated StoreLocation request/resource/service or test exists today; validation and response construction are controller-inline.

### 3.3 Current frontend direct usage

- CRM: `src/app/(dashboard)/store/page.tsx` and `store/[id]/page.tsx` already manage locations; `BankAccount{CreateModal,EditModal,Row}.tsx` and `bankAccountUtils.ts` expose location-oriented bank-account configuration.
- Ecommerce: `src/components/checkout/CheckoutForm.tsx` loads/selects pickup stores; account order detail, reviews, thank-you, `src/lib/apiClient.ts`, and `src/lib/server/getOrderDetail.ts` consume store/pickup fields.
- Booking: only `src/lib/apiClient.ts` contains direct store/branch-shaped text today; booking journeys do not yet select or attribute a location.
- No global branch selector, branch context/store, or user-to-location assignment UI exists.

## 4. Current cross-cutting architecture

### 4.1 Admin, roles, and permissions

`User` uses Sanctum, optionally belongs to `Staff`, and belongs-to-many `Role` through `role_user`. `Role` belongs-to-many `Permission` through `permission_role`; permission checks are slug-based in `CheckPermission`. Super Admin is detected by configured role name (`infra_core_x1` default), and admin management has delegation rules. `AuthController`, `AdminController`, `RoleController`, `PermissionController`, their requests/inline validators, `routes/api.php`, and CRM admin/role/permission pages/components form the current admin surface.

**Recommendation:** add `User::storeLocations()`, `StoreLocation::users()`, a `StoreLocationAccess` policy/service or middleware, query scopes, and request branch resolution. Do not overload `roles`, `permissions`, or `staff_id`. `All Branches` is a query mode, never a stored branch row or authorization grant. For specific-branch requests accept an explicit `store_location_id` (route/query/body according to operation), verify it against an active capability-enabled location and the authenticated user's allowed set, and then scope every repository/query. Never authorize from a remembered browser cookie.

### 4.2 Product, variant, inventory, and stock movement

`Product` is the global product identity/catalog and presently owns global price/sale windows, SKU/barcode-ish metadata, flags, cost/inventory value and `stock_quantity`. `ProductVariant` belongs to product and carries variant identity, price/sale/stock-related state and bundle relationships. Cart/order items snapshot names, prices, variant and cost information. Two stock histories exist: older `StockMovement` (`change`, reason/reference) and richer `ProductStockMovement` (product/optional variant, before/change/after quantities, value/cost snapshots, revoke/reversal and actors). This duplication is a migration risk.

**Target:** global `products`/`product_variants`; branch configuration such as `store_location_products` (availability, branch price overrides, optional reorder/settings) and branch inventory at variant granularity. Prefer a dedicated balance table such as `store_location_product_inventories` keyed by `(store_location_id, product_id, product_variant_id)` with a deliberate representation for non-variant products; every `product_stock_movements` row needs non-null `store_location_id`. Do not merely add a location to global `products.stock_quantity`, and do not retain two authoritative stock ledgers. Decide whether variant stock is authoritative before schema design.

Affected backend areas: `ProductController`, `ProductMediaController`, `PublicShopController`, ecommerce cart/checkout/order controllers and services, `PosController`, dashboard/report controllers/services, low-stock command/job, `Product`, `ProductVariant`, both movement models, cart/POS/order item models, bundle models, their migrations/seeders, `routes/api.php`, and stock/POS/report tests. CRM product create/edit/list, both stock-movement paths and revoke page, POS, rewards products, promotions, category filters, reports/dashboard, corresponding hooks/types/API helpers are affected. Ecommerce catalog/product/cart/checkout hooks/types/state are affected.

### 4.3 Booking services, staff, schedules, and commission

`BookingService` is global, category-linked, has duration/deposit/pricing/rules/slots/questions and a many-to-many allowed-staff relation. `Staff` is global and may own one admin login; commission rates are currently staff-global. `BookingStaffSchedule` is keyed only by staff/day/time, and time-off/leave/blocking and availability are not branch-scoped. `Booking` has service/staff/customer/timing/payment/source but no location. Commission tables/logs derive from bookings/orders and similarly lack location.

**Target:** keep staff identity global; use a staff/location pivot (prefer `staff_store_location` or a richer `staff_store_location_assignments` table if effective dates/active status are required), service/location configuration, branch-specific schedules/time-offs/blocks, and non-null booking attribution. Avoid deriving staff branch solely from the linked admin user's access because staff assignment and admin authorization are distinct concerns. Commission policy may remain global rates, but sales/month/log reports must carry or derive immutable transaction branch.

Affected backend: Booking service/category/product/availability/cart/booking/payment/refund/report/commission/leave/block controllers, services and console commands; `StaffController`; all `Booking*`, staff commission/monthly sale, service package usage and payment models involved; booking migrations and seeders; booking/availability/POS-settlement/commission tests. CRM booking services/categories/products, appointments/history/daily booking, blocks, schedules, staff, leave, commissions, reports, POS appointment pages and shared appointment components. Booking shop service/category/staff/date/slot/cart/checkout/confirmation/account pages, API client, hooks, contexts/stores and types.

### 4.4 POS carts, checkout, orders, and cash

`PosCart` belongs to the staff user and owns product, service, package, appointment-settlement lines and voucher snapshots; it has no branch. Checkout creates a shared `orders` record with `created_by_user_id`; order items can represent mixed sale types and staff splits. Cash shifts, pools and ledgers are user/shift-oriented without store attribution. Thermal printer settings are global.

**Target:** operational POS always requires one location. Add non-null `store_location_id` to POS carts, resulting orders, cash shifts/pool accounts/ledgers, and branch printer/settings records. Propagate, never infer later. Validate every line's branch availability and stock within the checkout transaction. Keep snapshot children inheriting branch through the immutable parent unless independent cross-branch movement is possible; avoid redundant branch columns on every order child.

### 4.5 Ecommerce shipping and pickup

Checkout currently offers shipping or pickup and persists nullable `pickup_store_id`. Active store loading exists, but there is no pickup-capability flag and stock is global. Delivery has no defined fulfilment branch. A pickup order must have exactly one active, pickup-enabled branch and every cart line must be available there.

**Concurrency requirement:** browser validation is advisory. Backend order creation must begin a DB transaction, lock branch inventory balance rows (`SELECT ... FOR UPDATE` or atomic guarded decrements), re-evaluate bundle quantities and reservations, fail the whole cart if any line is insufficient, persist the chosen pickup location and business attribution, and commit inventory reservation/movements with the order. Expiry/cancel/refund/reversal must be idempotent. Define reservation vs decrement timing and prevent double release. Add composite indexes and concurrency tests; cart UI stock can be stale.

### 4.6 Packages, member points, vouchers, and redemption

Customers/members, wallet, membership tiers and points balances/ledger are company-wide today. Service package catalogue/ownership/balances/usages are global. Vouchers support product/category scopes and customer assignment; loyalty rewards/redemptions cover product/voucher rewards. None has branch applicability.

**Target:** keep customer identity, membership, aggregate points, package catalogue and ownership global. Add applicability pivots/configuration for packages/vouchers/redeem products where owner rules demand it. Attribute package usage, voucher usage, loyalty redemption fulfilment, points earn/redeem transactions and inventory movements to the branch that performed them. Do not add a location to customer/member master, membership tier, points balance, or package ownership merely because usage is branch-attributed. Confirm whether packages bought at one branch are usable at all branches and who receives revenue/commission.

### 4.7 Payment gateways, bank accounts, settings

`PaymentGateway` stores global keys/config and purpose availability; `Setting` is a global typed key/value store. Bank accounts already have partial store-location behavior across model/controller/public endpoints/CRM. Booking settings and Billplz options are also global.

**Target:** avoid copying secrets into arbitrary location rows. Prefer gateway/location enablement/config override records with encrypted sensitive values, explicit fallback rules, and branch-scoped bank accounts. Add a generic branch settings table only if domain-specific tables cannot express validation. Printer, cash drawer, POS, booking, and fulfilment settings are branch-specific; branding, SEO, menus, notification templates and company-wide loyalty defaults normally stay global.

## 5. Data classification and FK plan

### 5.1 Remain globally shared (no `store_location_id`)

`users`, `roles`, `permissions`, RBAC pivots; `customers`, customer addresses and customer types; membership tiers/rules; product and variant identity/media/category tables; booking service/package catalogue identity and question/media/category tables; service package ownership and balances (usage is separate); points aggregate/balance configuration; global branding/SEO/menu/landing/notification templates; audit vocabulary; and immutable child/snapshot tables whose parent already has a mandatory branch and which cannot move independently.

### 5.2 Branch-specific configuration (usually composite/pivot, not a column on the master)

- `store_location_products` and variant/inventory balance records: availability, price override, stock and operational values.
- `store_location_booking_services`: availability, branch duration/price/deposit/rules if configurable.
- staff assignment and branch schedules/time-off/blocks.
- voucher/package/reward applicability pivots.
- payment gateway/location and bank-account/location enablement/config; branch settings/printer/cash drawer.
- pickup/booking/POS capability flags on `store_locations` itself.

Configuration FKs should usually be non-null and cascade on deletion only because deletion will be prohibited for referenced locations; unique composite keys are mandatory. Deactivation must preserve rows.

### 5.3 Transaction attribution

| Table/domain | Recommendation | Nullability/backfill | FK deletion |
|---|---|---|---|
| `orders.store_location_id` | Required sales/fulfilment branch for POS; owner rule for pickup/delivery. Keep `pickup_store_id` separately. | Add nullable, backfill, then make non-null only after every channel rule exists; delivery may remain nullable temporarily. | `restrictOnDelete`/no action. |
| `pos_carts` | Required operational branch. | New carts non-null; expire/assign old open carts before constraint. | restrict. |
| `bookings` | Required service branch. | nullable → default backfill → non-null. | restrict. |
| `product_stock_movements` | Required ledger branch. | nullable → default backfill → non-null after balances reconcile. | restrict. |
| legacy `stock_movements` | Freeze/migrate to canonical ledger or add same required field temporarily. | reconcile before cutover. | restrict. |
| `pos_cash_shifts`, cash pool accounts/ledgers | Required. | backfill by default/user evidence, reconcile balances. | restrict. |
| `expenses` | Usually required branch, unless genuine company overhead; consider explicit global/branch scope. | owner decision before constraint. | restrict. |
| `booking_blocks`, schedules/timeoffs | Required when operational; staff leave may be company-wide and needs explicit scope semantics. | default backfill. | restrict. |
| `customer_service_package_usages` | Required usage branch. | backfill from booking/order where possible. | restrict. |
| `voucher_usages`, `loyalty_redemptions`, `points_redemptions` | Attribute redemption/usage branch; points earn ledger may derive from source but snapshot is safer for reports. | nullable/backfill/non-null where in-person action. | restrict. |
| booking/order payments and refunds | Normally inherit immutable branch from parent; add a direct field only for independently routed/cross-branch settlement. | no redundant column initially. | parent integrity. |
| item/split/log/receipt/upload/return children | Inherit parent branch unless cross-branch transfer is a real workflow. | no column initially. | preserve parent/history. |

### 5.4 Default-branch backfill population

Backfill existing orders (business branch separate from pickup), bookings, booking blocks/schedules/timeoff as policy permits, POS carts, cash shifts/pools/ledgers, expenses if branch-scoped, both stock movement histories and new inventory balances, package usages, voucher usages/redemptions, points redemption/earn records where reports require it, payment/bank/settings mappings, staff assignments, service/product availability, and report aggregates/materialized snapshots. Prefer source evidence (`pickup_store_id`, linked booking/order, creator/staff assignment) before defaulting. Record counts, exceptions and reconciliation totals. Never overwrite `pickup_store_id` for delivery orders.

### 5.5 Deletion, cascade, and history risks

`nullOnDelete` on `orders.pickup_store_id` and `page_reviews.store_location_id` destroys attribution; hard deletion also cascades images and may orphan external assets/configuration. All business/config/transaction FKs should prevent location deletion. The application should return 409/422 with “deactivate instead,” forbid deactivating the last viable branch or a branch with unsafe open operations, and retain its name/code/address snapshots or relationship for history. Deactivation must exclude it from new pickup/booking/POS and new admin selection while permitting authorized historical reads and settlement/closure workflows. Cascades remain appropriate only for access/config pivots and location images if an unreferenced never-used branch is exceptionally purged by an audited maintenance procedure.

## 6. Global branch context and enforcement

### CRM design

Create a `BranchProvider`/hook near `src/app/(dashboard)/layout.tsx`; render a header selector in `src/components/Header.tsx` and a compact/mobile navigation selector. Load allowed active locations from an authenticated `/me/store-locations` endpoint. Options use actual names plus virtual **All Branches**, never “Store 1/2.” Remember only the location ID locally for UX, validate it against refreshed access, and fall back predictably. API helpers attach explicit `store_location_id` to scoped requests.

Pages fall into:

- **Specific branch required:** POS and appointment creation, staff schedule, stock adjustment/revoke, cash drawer/shift, printer settings, operational booking blocks.
- **All allowed branches permitted:** dashboards, lists, histories, activity, order/booking/report/commission/expense views (with branch column and aggregation label).
- **Global:** RBAC, member master, global catalog identity, company branding/SEO/menu/notification configuration unless later made configurable.

### Backend enforcement points

1. Authenticate and run existing permission middleware.
2. Resolve branch from explicit request input; reject ambiguous branch for operations.
3. Authorize it through Super Admin bypass or `store_location_user` membership; do not trust cookies, headers without validation, model IDs in nested payloads, or frontend filtering.
4. Validate active/capability status for new operations; permit inactive history according to policy.
5. Scope route-bound models and every query/aggregate/export to allowed/requested locations. Prevent IDOR by checking the record's attributed branch, including nested order/booking/cart IDs.
6. Stamp branch server-side on created records and propagate it through jobs, commands, events, notifications and reports.
7. Recheck under transaction locks at checkout/stock movement boundaries.
8. Log branch selection/creation/update/deactivation/access assignment and privileged All Branches exports.

Do not use a global Eloquent scope that can silently disappear in console/jobs; prefer an explicit resolver plus policy/query scopes and tests. Background jobs must serialize the branch ID and service identity.

## 7. Compatibility, reporting, and risk register

- **API compatibility:** adding response fields is normally safe, but requiring request fields breaks existing CRM/shop clients. Use additive nullable schema, version/capability rollout, server default only during a bounded compatibility window, and explicit validation after clients deploy. Preserve `pickup_store_id` meaning and existing store endpoint shapes. Paginated report totals must be scoped identically to rows.
- **Frontend compatibility:** persisted selections can reference disabled/revoked locations; SSR/client hydration and multiple tabs can disagree. Centralize context, validate on login/access refresh, show branch labels on records, and disable operations until one branch is chosen. Mobile navigation must expose the same control.
- **Authorization:** filtering lists without checking show/update/delete/export endpoints is IDOR. Jobs and report endpoints are common bypasses. Super Admin bypass must be tested and audited.
- **Reporting:** every KPI needs explicit global vs branch semantics; “All Branches” must aggregate only allowed branches. Historical branch names should remain resolvable. Avoid double counting orders, booking settlement lines and package usage. Add branch/grouping indexes to order dates/status, booking dates/status, movement dates, payment and staff split queries.
- **Inventory:** current global product/variant quantities and two movement models can drift. Branch rollout requires reconciliation, single authority, atomic reservations, idempotent reversal, bundle explosion rules, negative-stock policy, and load/concurrency tests.
- **Payments/settings:** secrets and webhook routing require branch-aware lookup based on persisted transaction context, never current UI context. Define fallback and uniqueness.
- **Deactivation:** open bookings, carts, cash shifts, unfulfilled pickup orders, inventory and staff schedules need a closure checklist; “inactive” must not make history inaccessible.
- **Future tenancy:** do not add `tenant_id`, tenant middleware, tenant databases, tenant RBAC or tenant-aware domains now. A future tenant layer can sit above locations.

## 8. Phased implementation plan

Each phase below lists exact current files or new filenames likely affected. New filenames are proposals and must be confirmed against conventions before implementation.

### Phase 0 — audit only (this document)

- **Files:** only `docs/PHASE/multi-branch-impact-analysis.md`.
- **DB/data/backend/frontend/auth:** none.
- **Compatibility/tests:** review document against schema (`rg` reference inventory, route review, migration review); stakeholder sign-off on unresolved decisions.
- **Rollback:** remove/revert this document only.
- **Risks:** missed dynamic SQL/string-less relationships; future checked-in migrations can change conclusions.
- **Must remain unchanged:** all source, schema, seed data, production data, API behavior, UI and authorization.

### Phase 1 — extend `store_locations` and protected Branch Management

- **Exact files likely affected:** backend `app/Models/Ecommerce/{StoreLocation,StoreLocationImage}.php`, `app/Http/Controllers/StoreLocationController.php`, preferably new `app/Http/Requests/StoreLocation/{Store,Update}StoreLocationRequest.php`, new policy/action for deletion/deactivation, `routes/api.php`, permission seed/patch following existing `PermissionSeeder.php`/Super Admin conventions, `StoreLocationsSeederReal.php`, `DatabaseSeeder.php`; CRM `src/app/(dashboard)/store/{page.tsx,[id]/page.tsx}`, relevant store types/API code colocated there or new `src/types/storeLocation.ts`, navigation/sidebar permission mapping, and image form components if extracted.
- **Migration:** add boolean capability flags with safe defaults matching current behavior (`is_pickup_available=true` only if every current active location truly was pickup; otherwise false and explicitly configure), booking/POS defaults false, nullable/defaulted `sort_order`; add indexes for `(is_active, capability, sort_order)`. Do not create branch or access pivots.
- **Data:** populate flags for existing locations only; seed exactly one default for fresh/dev installs, idempotently by code. No new production branches.
- **Backend:** validate flags/order; make code immutable on update; replace destroy with guarded deactivation (keep route compatibility by returning a clear error if necessary); public pickup endpoint filters active + pickup enabled; preserve images.
- **Frontend:** relabel Store page to Branch Management, edit name/flags/order/status, protected create page/modal, show immutable ID/code; no global selector.
- **Authorization:** creation and lifecycle limited to Super Admin or a single explicit `store-locations.manage` permission granted only to Super Admin initially; public list exposes only necessary safe fields.
- **Compatibility:** additive fields; retain endpoint URLs and `StoreLocation` naming; keep legacy consumers working. Announce hard-delete behavior change.
- **Tests:** migration up/down; model casts; list filters/sort; create authorization 401/403/success; unique/immutable code; update name; flag validation; public pickup exclusion; deactivation; referenced location cannot delete; images and old response regression; CRM typecheck/lint/build and component/E2E permission/flag flows.
- **Rollback:** before deployment export location flags; down removes only new columns/indexes. If application rollback occurs first, additive columns are ignored. Do not restore hard deletion; reactivation is operational rollback.
- **Risks:** defaults accidentally expose a location; existing clients expect active-only rather than capability filtering; permission seeds drift.
- **Explicitly unchanged:** no `branches`, user-location pivot, global selector, transaction attribution, inventory, booking/staff/POS logic, gateway redesign, tenant concepts or bulk business-data backfill.

### Phase 2 — admin-to-branch assignment and backend authorization

- **Files:** `app/Models/{User}.php`, `app/Models/Ecommerce/StoreLocation.php`, `AuthController.php`, `AdminController.php`, new `StoreLocationAccess` policy/service/middleware and assignment request/controller/resource, `routes/api.php`, admin/permission feature tests; CRM admins page plus `AdminCreateModal.tsx`, `AdminEditModal.tsx`, `AdminRow.tsx`, auth user types/state/API client.
- **Migration/data:** create `store_location_user` with two constrained FKs, timestamps, unique pair and indexes. Seed no production grants; a reviewed backfill assigns existing non-Super Admin users to default branch, with Super Admin bypass. Report unassigned active users.
- **Backend/auth:** expose allowed-location endpoint; enforce assignment on newly branch-aware endpoints; ensure actor cannot grant locations they cannot administer. Roles remain global.
- **Frontend:** multi-select actual branches in admin management; display assignments; no business-module filtering yet.
- **Compatibility:** compatibility default may treat legacy unassigned users as default-branch only for a short flagged window; never “all.”
- **Tests:** pivot constraints/duplicates/cascades, Super Admin bypass, assigned/unassigned/revoked/inactive access, IDOR, assignment delegation, auth payload compatibility.
- **Rollback:** stop enforcement, remove UI, export/drop pivot; retain audit export. Revert users to legacy access behavior.
- **Risks:** accidental lockout or overbroad Super Admin logic.
- **Unchanged:** permission slugs are not branch-specific; no per-branch roles; business records still unscoped.

### Phase 3 — global CRM branch context and selector, without module conversion

- **Files:** CRM `src/app/(dashboard)/layout.tsx`, `src/components/Header.tsx`, mobile/sidebar navigation components, auth store/context and API client; new `src/contexts/BranchContext.tsx`, `src/hooks/useBranch.ts`, `src/types/storeLocation.ts`. Backend authenticated allowed-location route/controller/resource.
- **Migration/data:** none.
- **Backend/auth:** validate selector options returned; no cookie authorization.
- **Frontend:** actual-name selector, virtual All Branches, persistence/fallback, specific-branch guard component. Modules not yet converted must ignore context explicitly and be labelled not branch-scoped.
- **Compatibility/tests:** feature flag selector; unit tests for fallback/revocation/persistence, SSR/hydration, desktop/mobile accessibility, API endpoint permissions; existing page regression.
- **Rollback:** disable flag/remove provider; no data rollback.
- **Risks:** users mistake cosmetic context for security/scoping.
- **Unchanged:** no module query changes or transaction stamps.

### Phase 4 — core transaction attribution and default backfill

- **Files:** `Order` model/migration and `OrderController`, `PublicCheckoutController`, `PosController`, public history/payment controllers; booking `Booking` model/controllers/services; expense controllers/models if approved; report/dashboard query services/controllers; resources/API types; CRM order/booking/expense lists/details/filters; ecommerce order types/history/thank-you; booking account/history types.
- **Migration/data:** add nullable indexed `store_location_id` to agreed core parents (`orders`, `bookings`, and approved expenses), restrict FKs; deterministic backfill script/command with dry run, exception log, counts/totals; later constraint migration where channel rules are complete.
- **Backend/auth:** server-side attribution and scoped read/show/update/export; propagate to jobs.
- **Frontend:** branch filter/column, specific branch on creation; All Branches on read/report.
- **Compatibility:** temporarily default legacy writes, emit telemetry/deprecation; never repurpose pickup field.
- **Tests:** each channel attribution, pickup vs business branch, delivery owner rule, backfill fixtures/idempotence, unauthorized record IDs, reports restricted to allowed set, historic inactive branch.
- **Rollback:** first stop requiring/writing field; retain columns for safe app rollback. Constraint down to nullable; restore from export only if backfill was wrong. Dropping attribution is last resort.
- **Risks:** incorrect delivery attribution and misleading historical reports.
- **Unchanged:** catalog/inventory/package rules remain global.

### Phase 5 — booking and staff branch support

- **Files:** all runtime files under `app/Http/Controllers/Booking`, booking availability/services, `StaffController`; models `Staff` and `Models/Booking/{BookingService,BookingServiceStaff,BookingStaffSchedule,BookingStaffTimeoff,BookingBlock,Booking,StaffCommissionLog,StaffCommissionTier,StaffMonthlySale}.php`; booking commands/jobs; CRM booking appointments/services/blocks/staff-schedules/staff/leave/commission/report pages; booking shop `src/lib/apiClient.ts` plus service/staff/slot/cart/checkout pages, hooks, types and state discovered under `src`.
- **Migration/data:** staff/location assignment; service/location configuration; location on schedules/timeoffs/blocks as policy dictates; backfill default and validate overlaps per branch.
- **Backend/auth:** branch-aware availability, staff eligibility, appointment CRUD, schedule collision and commission grouping.
- **Frontend:** require branch before appointment/schedule; booking shop selects/receives booking-enabled branch and retains it through checkout.
- **Compatibility/tests:** staged optional branch parameter then required; cross-branch overlap/availability, staff multi-assignment, disabled branch, leave semantics, commission/report scoping, booking journey E2E.
- **Rollback:** feature flag reads old global configuration; keep additive tables/columns; revert constraints before dropping anything.
- **Risks:** double-booking if collision query omits branch or global staff exclusivity is unclear.
- **Unchanged:** staff identity/login and role model remain shared; package usage rules wait for Phase 7.

### Phase 6 — POS, product availability, and branch inventory

- **Files:** `ProductController`, `PublicShopController`, `Ecommerce/PosController`, cart/order/stock controllers/services, low-stock command/job; models `Product`, `ProductVariant`, `ProductStockMovement`, `StockMovement`, `PosCart*`, `PosCash*`, `Order*`; CRM product create/edit/list, stock-movement/revoke pages, `pos/page.tsx`, POS appointments, cash reports, printer settings, product/profit reports; ecommerce catalog/cart types/hooks only when availability response becomes branch-aware.
- **Migration/data:** product/location configuration and inventory balances; non-null location on canonical movements, POS carts/cash structures and POS orders; indexes. Reconcile global quantities and movement totals, initialize per default branch, freeze writes during cutover.
- **Backend/auth:** require one POS branch, atomic inventory service, branch-specific prices/availability, branch cash/printer config; retire/freeze duplicate ledger.
- **Frontend:** branch-bound POS/cart, stock adjustment and printer/cash UI; prevent branch switching with non-empty cart/open shift.
- **Compatibility/tests:** dual-read comparison before cutover, single-writer flag, totals reconciliation; atomic concurrent sale/adjust/revoke, variants/bundles, insufficient stock, cart switch, cash shift, report tests and POS E2E.
- **Rollback:** stop writes, reconcile deltas back to global quantities, switch reader/writer feature flag, retain new ledger for audit; never blindly drop movements.
- **Risks:** highest-risk phase—overselling, cost drift, bundle errors, open-cart ambiguity.
- **Unchanged:** product/variant IDs and catalog identity remain global; no ecommerce pickup enforcement until Phase 8.

### Phase 7 — package, voucher, points, and redemption rules

- **Files:** customer/service package, redeem, loyalty, voucher and reward controllers/services/models; `CustomerServicePackage*`, `ServicePackage*`, `Voucher*`, `Points*`, `Loyalty*`, reward models; CRM membership/customer history/service packages/voucher/reward/redemption/POS/report pages; shop rewards/voucher/account/checkout types/hooks/pages; booking package cart/checkout pages.
- **Migration/data:** applicability pivots approved by owner; location attribution on usage/redemption ledgers; backfill from parent transaction/default with exception report.
- **Backend/auth:** branch applicability plus shared ownership/points semantics, inventory linkage and immutable usage snapshots.
- **Frontend:** branch rule editors, eligibility messages, branch columns/filters.
- **Compatibility/tests:** default “all active branches” only if owner approves; tests for cross-branch package usage, voucher scopes combined with product/category/branch, points earn/reversal, redemption stock and concurrency.
- **Rollback:** disable enforcement, preserve usage attribution, remove only unused config after export.
- **Risks:** customer-facing entitlement changes and double counting.
- **Unchanged:** customer/member master, total points and package ownership stay shared.

### Phase 8 — ecommerce self-pickup inventory validation

- **Files:** `PublicCheckoutController`, ecommerce cart/order/inventory services and `Order`/movement models; `routes/api.php`; ecommerce shop `src/components/checkout/CheckoutForm.tsx`, cart/checkout state/hooks/types, `src/lib/apiClient.ts`, thank-you and account order pages; CRM pickup order views.
- **Migration/data:** normally none beyond Phase 6/4; add reservation/index structures only if the approved stock timing needs them.
- **Backend/auth:** active + pickup-capable filter, whole-cart branch availability, transactional locked revalidation/reservation, idempotent expiry/cancel/release.
- **Frontend:** choose one real pickup branch, display branch availability, refresh on cart change, handle 409 stock conflict without losing cart.
- **Compatibility/tests:** endpoint version/feature flag; simultaneous last-unit checkout integration test, multi-item atomic failure, variant/bundle, disabled branch, stale UI, retry/idempotency, release/reversal and delivery regression.
- **Rollback:** disable branch stock checkout and revert to approved safe policy (pause pickup preferred over global overselling); release new reservations through audited command.
- **Risks:** race conditions, deadlocks, reservation leaks and incorrect pickup/business attribution.
- **Unchanged:** shipping UX and delivery attribution rule except where owner explicitly approved in Phase 4.

### Phase 9 — dashboard, reporting, and final regression

- **Files:** dashboard analytics/report controllers/services/commands/index migrations; CRM dashboard and every `reports/**` page plus shared report components; export jobs; order/booking/commission/expense/customer report tests.
- **Migration/data:** branch-oriented indexes and, only if necessary, branch-keyed aggregate snapshots; validate historical backfill coverage.
- **Backend/auth:** scope every metric, chart, export and drill-down to selected/allowed set; consistent timezone and cross-branch totals.
- **Frontend:** selector-aware titles, filters, branch column, All Branches aggregation and empty/partial-access states.
- **Compatibility/tests:** compare All Branches against sum of branches, permissions/IDOR/export, inactive history, performance/explain plans; full Laravel, CRM, shop and booking lint/type/build/E2E regression.
- **Rollback:** remove indexes/aggregate readers through feature flags; raw transaction attribution remains. Restore previous dashboard while preserving data.
- **Risks:** silent overexposure and double counting.
- **Unchanged:** RBAC semantics and shared master classification.

## 9. Exact frontend impact inventory by surface

Because most frontend modules currently have no branch concept, files are grouped by the pages/components/API/state that must change when their owning phase arrives:

- **CRM shell/auth/state:** `(dashboard)/layout.tsx`, `components/Header.tsx`, sidebar/mobile navigation components, login/auth API routes and auth store/hooks/types, shared API fetch/proxy utilities.
- **Branch/admin:** `store/page.tsx`, `store/[id]/page.tsx`, `admins/page.tsx`, `Admin{Create,Edit,Row,Table,Filters}*`, roles/permission pages only for management permission display.
- **Transactions:** `orders/{page,new,completed}`, `Order*`; booking appointments/history/daily pages and appointment components; expenses; returns/history/details.
- **Operational:** `pos/page.tsx`, `pos/appointments/page.tsx`, booking `staff-schedules`, `blocks`, staff/leave pages, product stock-movement and revoke pages, `reports/cash-shifts`, thermal printer.
- **Catalog/config:** product list/create/edit and product components/types; booking services/categories/products; promotions; service packages; vouchers/rewards; payment gateways/bank accounts/general and booking settings.
- **Analytics:** dashboard, my-sales, commissions and all `reports/**` pages/shared report components.
- **Ecommerce shop:** `lib/apiClient.ts`, `lib/server/getOrderDetail.ts`, checkout form, cart/checkout hooks/context/store/types, pickup-capable catalog/product availability surfaces, account order detail, reviews and thank-you.
- **Booking shop:** `lib/apiClient.ts`, service/category/staff/availability pages/components, booking cart/checkout/confirmation/account pages, associated hooks/context/state/types. Today these do not carry a location, so Phase 5 must trace every request from discovery through payment.

Before each phase, regenerate a source inventory (`find <project>/src -type f`) and reference map (`rg -l 'order|booking|stock|voucher|payment|setting|report'`) because these projects use substantial page-local types and fetch logic rather than one centralized typed SDK.

## 10. Recommended Phase 1 scope

Deliver one safe, backward-compatible Branch Management slice:

1. Add capability flags and optional ordering to `store_locations` with reviewed defaults/indexes.
2. Extend model serialization and validation.
3. Make code immutable after creation and ID visibly immutable.
4. Replace hard delete with deactivation; block deletion of any referenced location and define last-active/capability safeguards.
5. Protect create/update/deactivate behind existing Super Admin/RBAC conventions.
6. Relabel the existing CRM store surface as Branch Management and expose name, capabilities, sort order and status.
7. Filter the public pickup list to active, pickup-enabled locations without changing `pickup_store_id`.
8. Keep a single idempotent default-location seed for installation/development.
9. Add focused backend and CRM tests plus API contract documentation.

### Explicitly not in Phase 1

No new `branches` table; no `store_location_user`; no branch selector/context; no per-branch permissions/roles; no transaction `store_location_id`; no backfill of orders/bookings/POS; no branch inventory/pricing/service/staff/schedule/package/voucher/points/gateway implementation; no tenant IDs/databases/middleware; no reinterpretation of pickup; no additional production branches or production seed data; no broad endpoint renames.

### Phase 1 acceptance checklist

- [ ] Migration is additive, reversible, indexed, and defaults are approved against production locations.
- [ ] Exactly one master (`store_locations`) exists; no `branches` artifacts.
- [ ] Super Admin can create a branch; unauthorized/unauthenticated callers receive 403/401.
- [ ] Name edits work; ID and post-create code cannot change through API or UI.
- [ ] Capability flags and optional order validate, persist and serialize.
- [ ] CRM labels the entity Branch and dynamically displays actual names.
- [ ] Public pickup returns only active + pickup-enabled locations and no secret/internal configuration.
- [ ] Referenced branches cannot be hard-deleted; deactivation preserves orders/reviews/images and history.
- [ ] Inactive branches cannot be selected for new pickup, but historical orders still render.
- [ ] Default seeder is idempotent and creates no second production branch.
- [ ] Existing store API consumers remain compatible; ecommerce checkout regression passes.
- [ ] Audit logging captures create/update/deactivate and actor.
- [ ] Backend tests and CRM lint/typecheck/build pass; migration up/down tested on a production-like copy.
- [ ] Deployment and rollback runbooks are reviewed.

### Proposed small commit series

1. `docs: record branch management decisions and API compatibility` (this plan/contract only).
2. `db: add store location capability flags and ordering` (migration + model casts only).
3. `api: validate branch capabilities and immutable codes` (requests/resource/controller tests).
4. `auth: protect branch management lifecycle` (permission/policy/routes/tests).
5. `api: replace branch deletion with deactivation safeguards` (history/deletion tests).
6. `crm: relabel store locations and edit branch capabilities` (types/UI/component tests).
7. `shop: filter pickup-capable active locations` (API/shop regression tests).
8. `seed: keep one idempotent default store location` (seeder test/docs).

Do not combine schema, authorization, UI, pickup behavior and seeding into one commit; that prevents safe review and rollback.

## 11. Unresolved owner decisions required before implementation

1. Which existing location/code is the default, and what exact capability defaults apply in production?
2. May an unused, never-referenced branch ever be permanently purged, or is hard deletion universally forbidden?
3. Is branch code absolutely immutable, and who can correct a creation typo (audited exceptional workflow vs never)?
4. Is Super Admin automatically authorized for every branch, including inactive ones? Who may manage user assignments?
5. Can staff work at multiple branches on the same day? Are staff conflicts global or only within a branch?
6. Are schedules, time off and leave branch-specific, company-wide, or selectable scope?
7. Are booking service price/duration/deposit/rules configurable per branch or only availability?
8. Are product prices branch-specific at product or variant level? Which value is fallback? Are promotions branch-specific?
9. Is inventory authoritative at variant level, product level for non-variants, or both? Which of the two movement ledgers is canonical?
10. When is ecommerce stock reserved/decremented (order placement, payment, fulfilment), how long is it held, and may stock go negative?
11. For delivery orders, which branch owns sale/fulfilment: customer selection, postcode routing, inventory source, manually assigned warehouse, or a default?
12. For pickup orders, is business `store_location_id` always equal to `pickup_store_id`, or can fulfilment/source differ?
13. May a POS order contain stock/services/packages fulfilled by multiple branches? Recommended v1 answer is no.
14. Can a branch be deactivated with open bookings, open POS shifts/carts, pending pickup orders or remaining stock? Define transfer/closure steps.
15. Are packages usable across all branches? Which branch receives package-sale revenue versus usage/commission attribution?
16. Are member points earned/redeemed company-wide at identical rates, and which branch owns liability/revenue reporting?
17. Are voucher/reward applicability defaults “all branches” or explicit opt-in? How do branch scope and existing product/category scope combine?
18. Are payment credentials genuinely different per branch? What are fallback, webhook ownership and secret encryption/rotation rules?
19. Are expenses always branch-specific, optionally company-wide, or split across branches?
20. Should inactive locations remain selectable in historical report filters, and should historical outputs use current branch name or a transaction snapshot?
21. Which operational pages must forbid **All Branches** beyond the stated POS/appointment/schedule/stock/cash/printer list?
22. Is a first-version user allowed the same global role across every assigned branch (recommended), and is any concrete requirement forcing per-branch roles?
23. What deployment window, write freeze and reconciliation tolerance are acceptable for the inventory cutover?
24. Which clients/API consumers outside the three checked-in frontends must be included in compatibility testing?

## 12. Final recommendation

Approve Phase 1 only after questions 1–4 are answered. Implement it as a master-data/lifecycle hardening change, not as implicit multi-branch enablement. Then require Phase 2 authorization before exposing branch context, require transaction attribution before reporting, and defer inventory and entitlement enforcement until their policies and rollback reconciliations are approved. This ordering preserves current contracts, historical records and a future path to tenancy without prematurely building tenant architecture.
# Phase 4 implementation note (2026-08-08)

Phase 4 was re-audited against the post-Phase-3 code and implemented as an additive nullable attribution foundation. See [the Phase 4 production runbook](phase-4-transaction-branch-runbook.md) for creation-path matrices, explicit read/legacy-NULL semantics, backfill rules, deployment, reconciliation, and rollback. The initial re-audit found no deterministic public Booking Branch and left it nullable; delivery ownership remains undefined and nullable rather than using an inferred default.

Phase 4 completion subsequently added explicit public Booking Shop Branch selection using active, booking-enabled StoreLocations. The selected Branch is persisted on the booking cart and inherited by its Bookings and checkout Order; no service, staff, schedule, or availability filtering was introduced.

The Branch step is conditional: zero booking-enabled Branches blocks booking, one is auto-selected behind the original four-step UX, and multiple Branches require the explicit five-step selector. This changes presentation only; backend validation and transaction attribution are identical in single- and multi-Branch modes.
# Phase 6A implementation refinement (2026-08-08)

The current-code re-audit confirms that Product identity and Product-level availability remain global/additive, while variant quantities remain required for future Branch inventory. Phase 6A uses `store_location_product`, `store_location_product_inventories`, and nullable `pos_carts.store_location_id`; the new inventory table is explicitly non-authoritative. Current Product/Variant fields, stock deductions/restorations, movement history, low-stock, reports, and public ecommerce behavior remain unchanged.

The audit also confirms a Phase 6B blocker: `ProductStockMovement` is actively written by CRM adjustment/revoke and POS stock paths and supports variants/reversals, while `StockMovement` is still written by ecommerce paid-order handling and lacks both. Phase 6A does not add Branch columns to either ledger or select a canonical ledger. See `docs/PHASE/phase-6-production-runbook.md` for reconciliation prerequisites and rollback.

## Phase 6B re-audit refinement (2026-08-08)

Phase 6B confirms `ProductStockMovement` as the candidate canonical Branch ledger and adds the schema/service/reconciliation foundation. Authoritative activation is intentionally blocked: ecommerce currently reserves/releases global Product/Variant fields without deterministic delivery Branch attribution, monetary partial refunds do not identify restock quantities, void/cancel restoration is not centralized, and loyalty reward stock writes lack Branch identity. The cutover state cannot be activated by the backfill command. Existing operational writers remain unchanged until these explicit stop conditions are resolved; no Phase 6C, 7, or 8 behavior is included.

## Phase 6C implementation refinement (2026-08-08)

The POS cash re-audit confirms Cash Shift and the physical carried Cash Pool Account as Branch-operational parents. Ledger children inherit Branch through those parents, avoiding redundant attribution. Structured per-Branch POS printer settings replace global printer writes with a legacy read fallback. Authorized Branch Context exposes cutover status with explicit non-authoritative labels, while global Product/Variant stock and low-stock behavior remain unchanged. Phase 6B inventory authority remains inactive and its blockers remain unresolved.

### PostgreSQL uniqueness correction

Phase 6A inventory identity uniqueness is implemented with separate partial unique indexes for NULL-Variant Product rows and non-NULL Variant rows. This replaces the non-portable virtual generated column while preserving nullable Variant semantics and the exact Branch/Product/Variant uniqueness rules. Phase 6B reconciliation and mutation queries now match nullable `product_variant_id` directly.

## Phase 7 implementation refinement (2026-08-08)

The current-code re-audit confirms global Customer identity, global FIFO point balance, global Package definitions/ownership/balances, global Voucher identities, and global Loyalty Reward identities. Phase 7 adds nullable transaction attribution without partitioning any master or entitlement. Package applicability was not needed because packages already restrict eligible Booking Services and their shared balance is concurrency locked. The initially proposed Voucher/reward applicability was removed by the correction below.

Redeem Product has no redundant Branch pivot and persists the actual claim Branch when known. Initial Ecommerce redemption is global; Phase 6A Product availability remains available for POS and later fulfilment validation. Quantity checks/mutations intentionally remain on current global Product stock. Branch Inventory authority remains inactive, ecommerce inventory/reservations are unchanged, and no multi-tenant concepts are introduced. See [the Phase 7 runbook](phase-7-benefit-branch-runbook.md) for write paths, safe backfill, reconciliation, rollback, legacy NULL semantics, and Phase 8/9 deferrals.

## Phase 7 global-benefit correction (2026-08-09)

The first-version business decision is revised for the single shared Ecommerce website: Voucher, Redeem Voucher, and Redeem Product eligibility are global. Branch is recorded as transaction attribution when POS, Booking, Order, or fulfilment provides a deterministic Branch; genuinely unresolved Ecommerce attribution remains NULL without a default. Voucher/Reward Branch enforcement, applicability pivots, and CRM checklists are removed rather than retained as inactive-looking architecture.

Redeem Product no longer consults Phase 6 Product availability during the initial global reward claim. This does not remove or weaken `store_location_product`: POS continues to enforce Product availability, and later Ecommerce fulfilment/Branch Inventory work will validate the actual fulfilment Branch at the appropriate stage. Global stock remains authoritative, Branch Inventory stays inactive, and Phase 8 is not started. See the corrected [Phase 7 runbook](phase-7-benefit-branch-runbook.md).

## Phase 8 safe Ecommerce fulfilment foundation (2026-08-09)

Phase 8 keeps one global Ecommerce catalogue and introduces no pre-browse Branch choice. Self Pickup now validates the whole physical cart against one active, pickup-enabled Branch: every Product must be assigned and every exact Product/Variant or expanded bundle component must have sufficient candidate Branch inventory. Validation occurs at preview, before checkout creation, and again under Branch inventory row locks in the Order transaction. Successful pickup Orders retain distinct `pickup_store_id` and `store_location_id` semantics while persisting the same deterministic Branch for this v1 flow; delivery leaves both attribution fields NULL.

The re-audit found the inventory cutover stop condition still applies. Delivery ownership is undefined, global reservations/releases lack a durable Branch reservation ledger, partial monetary refunds have no exact line quantities, and POS/CRM/cancellation writers have not all moved to the candidate canonical `ProductStockMovement`. Consequently global Product/Variant fields remain authoritative, Branch balances are validation-only, no dual writes were added, and no activation command is shipped. Product rewards remain globally selectable, join stock reservation only when they become physical Order lines, and receive Branch attribution only for deterministic self pickup. Voucher, Redeem Voucher, Packages, and Points remain global. See the [Phase 8 production runbook](phase-8-ecommerce-fulfilment-runbook.md) for the audit matrix, commands, stop conditions, reconciliation, rollback, and Phase 9 deferrals.

### Phase 8 confirmed fulfilment and discount decisions (2026-08-10)

Shipping ownership is now deterministic: the system, not the customer, checks an administrator-configured ordered Branch priority and persists the first whole-cart-capable Branch as `orders.store_location_id`; `pickup_store_id` remains NULL. Self Pickup continues to persist the customer-selected single Branch in both semantically distinct fields. Neither flow splits fulfilment.

Promotion and Voucher have deliberately separate semantics. One global Promotion may enable the Online sales channel and independently select any number of Offline POS Branches; the final fulfilment Branch never changes Online eligibility. Voucher and Redeem Voucher remain globally eligible with Branch used only as deterministic transaction attribution.

Physical Product stock is confirmed to be independently Branch-specific. For active inventory, Ecommerce uses canonical Branch mutations plus durable idempotent Order reservations and maintains legacy Product/Variant quantities only as aggregate compatibility projections. Initial Product reward selection no longer deducts stock; the final Order fulfilment Branch deducts it exactly once. Production activation remains blocked because the current POS and CRM adjustment paths are not all converted. The legacy single-Branch backfill must not be used to allocate a global total across multiple physical Branches; actual quantities require reviewed operator input and a write freeze. No production force or activation was executed.

## Phase 8C final writer conversion (2026-08-10)

POS checkout and staff consumables now use persisted POS cart/Order Branch identity and the canonical Branch mutation boundary when authority is ACTIVE; Product add/update validates Phase 6A availability separately from exact Branch stock and final checkout revalidates atomically. CRM adjustment requires the specific global Header Branch, authorizes it through `StoreLocationAccessService`, and uses canonical Branch mutation when ACTIVE. Movement revoke uses the original movement Branch with an idempotent inverse movement. Pre-activation paths retain bounded global compatibility behavior and Branch inventory is not treated as authority.

`ProductStockMovement` is canonical for converted ACTIVE writers; `StockMovement` remains a history table and a bounded pre-activation payment compatibility writer only. Legacy Product/Variant quantities are derived aggregate projections after activation. Initial Product reward redemption remains Branch-free and stock-free; final Ecommerce fulfilment deducts exactly once. Voucher, Redeem Voucher, Package and Points remain global, while Phase 8B Shipping, Self Pickup, and Promotion semantics are unchanged.

Physical initialization now accepts independently reviewed per-Branch JSON counts with dry-run/force validation and refuses ACTIVE overwrites. Mixed activation is explicitly unsafe: all active physical Branches must be reviewed, complete and RECONCILED, then activate together using the fail-closed coordinated command. Migrations do not redistribute or activate inventory, and no production force/activation was executed. See the Phase 8 runbook for the final writer matrix, exact commands, staged cutover and rollback.

For the confirmed first production cutover, the legacy global balance is physically owned only by the existing Branch identified by immutable code `PNG`. `branch-inventory:initialize --store-code=PNG --from-global` provides a guarded dry-run/force migration into that Branch only, while preserving reviewed JSON initialization for future multi-Branch counts. It rejects non-zero inventory at another active Branch, conflicting or differently reviewed target balances, derived bundle stock, unsafe identities, and ACTIVE authority; it never activates inventory or changes Product Branch availability.

Branch-scoped Product listing is intentionally driven by `store_location_product.is_available`, not inventory quantity. The PNG inventory migration therefore does not make Products visible by itself; the separate idempotent `product-branch:backfill --store-code=PNG` command adds only missing legacy availability assignments while preserving explicit and other-Branch assignments. Category masters remain global, but CRM/POS visibility at a specific Branch is derived with an EXISTS check for at least one related available Product; counts use the same predicate. All Branches and public Ecommerce retain the global Category view, and no Category-to-Branch persistence is introduced.

## Phase 9 reporting and final regression (2026-08-15)

Phase 9 converts the rendered ecommerce dashboard inventory and sales surfaces to the authorized shared Header Branch Context and fixes Orders table Branch state ownership. All Branches is server-derived accessible scope, with legacy NULL transaction activity explicitly Unassigned; specific Branch never absorbs NULL. Global masters and entitlement balances remain global. The audit matrix, 52-point regression, limitations, and non-destructive production checklist are maintained in [the Phase 9 reporting runbook](phase-9-reporting-runbook.md).

## Phase 9B executable reporting completion (2026-08-15)

Phase 9B applies the existing `ReportBranchScope` safe default across executable Sales, Booking, Appointment, POS, Product Profit, ecommerce commission, stock movement, Return and Package-usage reporting. Specific Branch excludes NULL; All is derived from authenticated accessible StoreLocations and retains meaningful NULL as Unassigned. Operational Sales/Booking CSVs reuse the scoped services. Physical reporting uses accessible Branch inventory; low stock is evaluated per Branch and ACTIVE-Branch notifications name the shortage Branch.

Global masters and liabilities remain global. Expense has no deterministic Branch ownership, so restricted/specific Profit/Loss excludes company expenses rather than inventing attribution. Wishlist remains a labelled global Ecommerce-intent metric. No new benefit or Promotion report page, Excel/PDF report feature, stock workflow, tenant, organization or Branch entity was introduced. See [the Phase 9 reporting runbook](phase-9-reporting-runbook.md) for the executable ledger, test status, export classification, manual checks and remaining deterministic-attribution limitations.
