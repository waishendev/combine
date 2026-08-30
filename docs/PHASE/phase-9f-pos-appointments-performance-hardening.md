# Phase 9F — POS/Appointments request-lifecycle hardening

**Classification:** Phase 9 enhancement/hardening (not Phase 10)  
**Scope:** CRM POS checkout and POS Appointments; existing multi-Branch authorization is unchanged.

## POS catalogue Branch-context correction (2026-08-28)

POS now has one mandatory operational context: the specific Header Branch. The Product grid calls
`GET /api/pos/products/catalog?store_location_id={branch}` (and the search endpoint uses the same
parameter). The server authorizes it with `StoreLocationAccessService`, requires an available
`store_location_product` row, and reads stock from that Branch's
`store_location_product_inventories`; it does not fall back to global Product stock.

The lazy tab request inventory is:

| Tab | Frontend loader | Endpoint and scope | Server semantics |
|---|---|---|---|
| Products | `fetchProductPage` | `/api/pos/products/catalog` or `/api/pos/products/search`; `store_location_id`, page/category/search | Explicit authorized Branch; Product availability pivot and Branch inventory |
| Booking Products | `fetchBookingProducts` | `/api/pos/booking-products/search`; `store_location_id`, category/page | Global Booking Product definition is eligible only through its existing linked Booking Service assignment at the Branch |
| Book Service | `fetchServices` | `/api/pos/services/search`; `store_location_id` | Global service identity; operational availability through `booking_service_store_location` |
| Service Packages | `fetchServicePackages` | `/api/service-packages`; pagination only | Global sellable definitions remain global; there is no evidenced Package/Branch eligibility model |
| Settlement | `fetchUnpaidCompletedAppointments` | `/api/pos/appointments`; `store_location_id`, unpaid/search/page | Persisted `bookings.store_location_id` only; specific scope excludes NULL legacy rows |

Booking Products, Booking Services, Packages, and Settlement remain tab-selected lazy loads. Their
Branch-sensitive in-flight keys include `store_location_id`. A Header Branch change aborts Product
and opened-tab requests, clears Product/Booking Product/Booking Service/Settlement state, resets lazy
keys, and reloads only Products plus the currently visible lazy tab. Late old-Branch responses fail
the controller/request-identity check and cannot win. Unopened tabs stay unloaded. The prior Product
timer refresh was removed, so this correction adds no polling or eager catalogue requests.

The empty BOOK SERVICE regression was response-shape, not missing assignment data: the authorized
POS endpoint returns its list as `data.data`, while the lazy client only accepted a top-level array.
The loader now unwraps both supported envelopes, still sends `store_location_id`, and still rejects
late responses by AbortController identity. No service identity is copied or made Branch-owned.

## Audit and root causes

Static request-flow tracing found three independent amplification paths:

1. Appointments enabled a five-second list poll by default. The list asks for an entire month (`per_page=500`) and the next poll was dispatched even when the previous expensive request was still pending. A 70-second response could therefore accumulate about fourteen identical requests.
2. Initial Appointments effects fetched the active Staff list twice and the filter Staff list twice: once in the Branch-reset effect and again in independent mount effects. React development StrictMode could double those mount effects again.
3. POS loaded Booking Products in its Branch bootstrap and immediately loaded the same unfiltered page from the category effect. Product list searches used a sequence guard, so stale data could not win, but the obsolete HTTP work was not aborted.

The Header Branch context value is memoized and was not the loop source. There is no SWR/React Query retry policy and no failed-request retry loop. Printer settings already load independently during idle time, abort at eight seconds, and do not gate either workspace. Member searches already use a 300 ms delay; POS barcode search uses 180 ms and Booking Product search uses 220 ms. Modal-only appointment details, wallet, package, add-on, and availability calls remain on demand.

The backend appointment endpoint is intrinsically expensive for large months: it loads the authorized date/Branch result set, preloads active Order Items, then calculates financial/package/visit state before applying financial-status filtering and in-memory pagination. Existing code already uses a sargable timestamp range, eager-loads the four list relations, and request-local memoization. This change does not bypass those calculations or authorization. The overlapping frontend poll was the mechanism that turned one slow query into an unbounded backlog.

## Corrected lifecycle

- Appointment search text is debounced by 300 ms. Date, view, Staff, customer, status, schedule scope, or debounced search changes produce one logical list request.
- An in-flight key is composed from the selected Branch and canonical query string. An identical in-flight list request is suppressed. A different query aborts the old request; sequence checking still prevents a late response/finalizer from overwriting current state.
- Branch changes abort the old appointment list before clearing Branch-owned state. The new Branch response is the only response allowed to win.
- Five-second appointment polling is now opt-in. When explicitly enabled it remains bounded by in-flight deduplication.
- Cash Shift checks suppress a duplicate request for the same Branch and abort the old Branch check before starting another.
- POS Product list/search requests abort their predecessor. The redundant initial Booking Product call was removed; the existing category-driven effect owns that request.
- Optional printer failure remains a scoped warning and cannot block operational data.

## Request inventory and expected counts

Counts below are deterministic source-level counts for the audited duplicated/long-running subset, excluding Next authentication/Branch-provider calls, independent lookup calls, and user-opened modals.

| Action | Before | After |
|---|---:|---:|
| Appointments initial audited subset | 7 (appointment list, active Staff x2, filter Staff x2, cash shift, printer) | 5 (one each; printer remains optional) |
| Appointments idle list traffic | 12 list requests/minute, with overlap possible | 0 by default; at most one in flight when opt-in polling is enabled |
| 70-second appointment response under default polling | up to 14 same-URL requests accumulated | 1 same-URL request maximum |
| POS initial Booking Product list | 2 identical unfiltered triggers | 1 category-owned trigger |
| Branch A → B Cash Shift/list | both HTTP requests could continue | A aborted; B wins |

POS critical requests (Cash Shift, Cart, Product catalog) start independently. Categories, Staff, Booking services/products, packages and settlement lookups are secondary parallel requests and do not gate the Product grid. Printers, member details/history, appointment detail, add-ons, wallet, package eligibility and availability are optional or interaction-driven.

## Backend/query review and measurement limitations

No schema or index change is included: the repository provides neither a reachable seeded database nor production-sized appointment data in this container, so adding an index or claiming SQL timings would be speculative. Source inspection confirms Branch scope continues through `applyPosAppointmentBranchScope`; direct detail/action authorization was not changed. The existing `start_at` range is sargable and the endpoint already preloads the list's active Order Items. Production staging must capture Laravel query events and PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` before any further query/schema optimization.

No honest before/after backend response-time number is available in this container. The measurable request-concurrency improvement is from as many as fourteen identical pending list calls after 70 seconds to exactly one. Backend latency for that one call remains a rollout gate.

## Manual QA checklist

Use DevTools Network with **Preserve log** and Disable cache enabled. Group by URL and inspect timing/cancelled status.

### POS

1. Open under All Branches and confirm the existing gate requires a specific operational Branch.
2. Select PNG, then a second accessible Branch; verify old Product and Cash Shift requests are cancelled and no old data appears.
3. Add an item, select Staff, search/select a member, and open/close package, promotion, Product and checkout panels.
4. Confirm modal open/close and unrelated cart/UI state do not reload the catalog.
5. Simulate printer endpoint failure and confirm catalog/cart remain usable with only a printer warning.

### Appointments

1. Open under PNG, switch Branch, change month/date, Staff/customer/status filters, and type quickly in search.
2. Verify one appointment URL per settled action, a 300 ms search delay, and cancelled superseded requests.
3. Leave the page idle for one minute: there must be no list traffic until Auto Refresh is explicitly enabled.
4. Enable Auto Refresh with a throttled response and verify no more than one identical appointment request is pending.
5. Open and close an appointment/detail/settlement panel; only its on-demand detail resources should load.

## Tests and rollout limitations

The coordinator unit tests cover identical-key suppression and Branch A → B abort/latest-wins semantics. TypeScript and lint checks cover integration. Browser timing, Laravel SQL query counts, slowest SQL, duplicate SQL, and a production-size PostgreSQL plan remain mandatory staging QA. Production readiness is conditional on that staging evidence; the frontend request storm itself is bounded.

## Backend performance pass

### Endpoint trace and old pipeline

The workspace formerly called `GET /api/pos/appointments` through the CRM proxy. Laravel routes that request to `Ecommerce\PosController::appointmentSearch`, which delegates to `runAppointmentSearch`; `PosAppointmentStartAtFilter` applies the date predicate and `applyPosAppointmentBranchScope` resolves either the authorized specific `store_location_id` or the authenticated accessible-Branch set through `StoreLocationAccessService`.

The old execution order was source-confirmed as:

1. apply Branch, search, date, customer, Staff and coarse status predicates in SQL;
2. select and hydrate every matching Booking in the month, including customer, service, Staff and StoreLocation (`get()`, not SQL pagination);
3. preload active booking Order Items for every candidate;
4. execute the full financial, add-on, deposit, settlement, package eligibility/claim and visit-checkout calculations for every candidate;
5. for HOLD rows, resolve review Order and sibling Bookings;
6. apply completed paid/unpaid schedule filtering in PHP;
7. paginate the enriched collection in PHP.

The frontend's `per_page=500` was intentional: the month grid needs all visible appointments to group and count each calendar day. Changing it to 20 would make the calendar incomplete. The bottleneck was therefore not merely the count query or base Booking SQL; it was using a detail-grade DTO/calculation pipeline as a calendar feed. Source audit also found at least two visit/order existence/value queries per enriched Booking outside the existing active-Order-Item preload, plus package, Staff-split, price metadata and HOLD review lookups. Request memoization removed exact repeats but could not turn those per-Booking keys into bulk queries.

### New bounded calendar pipeline

The workspace now calls `GET /api/pos/appointments/calendar`. The original endpoint and response remain available for compatibility. The calendar endpoint:

1. selects only the Booking columns rendered or needed for classification;
2. pushes Branch, sargable date range, search (`EXISTS` for customer/service), Staff, customer and status/schedule-scope filters into SQL;
3. uses database `paginate`, so count and page slicing happen before Eloquent hydration;
4. eager-loads four constrained lookup relations only for the returned page;
5. bulk-loads at most one latest active package-usage row per returned Booking;
6. returns the existing list keys needed by the schedule, but performs **zero** financial-summary and visit-detail calculations.

Active schedule semantics use persisted `bookings.payment_status`, while preserving completed rows that remain operational because they have a reserved package or an unfinalized range price. Opening a row continues to call the authorized detail endpoint and computes the exact financial/package/visit DTO on demand. No long-lived cache was added.

The response envelope remains `data`, `current_page`, `last_page`, `per_page`, `total`, and `pending_cancellation_requests_count`. Individual calendar rows retain their existing identity, Branch, customer, service, Staff, timing, status, payment-tone and package-status keys. Detail-only monetary totals are deliberately not calculated in the feed and remain zero; persisted payment/package state drives the calendar tone, while the detail request supplies exact values.

### SQL work, hydration, and index

The new query budget is constant with page size: count + Booking page + four eager lookup queries + one bulk package query + cancellation count, **at most eight SQL queries** for a non-empty page. It has no per-row visit, Order Item, package-eligibility or financial queries. Before, the exact total depended on row types, but source inspection proves an `O(N)` query/calculation component after the base/eager queries. The feature regression test asserts the new non-empty page remains at or below eight queries.

Hydration changes from every matching month Booking followed by heavyweight enrichment to only the SQL-requested page of lightweight Bookings. The current month UI requests up to 500 because it genuinely renders the whole visible month, but those rows no longer hydrate settlement Orders/Items or execute detail calculations. Other clients can request smaller pages and now receive real SQL pagination.

A new migration adds `(store_location_id, start_at, id)` on `bookings`, exactly matching the primary authorized Branch + range + stable-order feed path. Existing `(staff_id,start_at)`, `(customer_id,start_at)`, `(status,start_at)`, package `(status,booking_id)`, Order Item `(booking_id,line_type)`, and Order Service Item `(booking_id)` indexes remain unchanged. The new index must still be validated against production PostgreSQL plans; no speculative secondary combinations were added.

### Development-safe profiling

In an environment with `APP_DEBUG=true`, append `profile=1` to the calendar request. Only that request temporarily enables the connection query log and returns `data.profile` containing endpoint duration, query count, summed SQL time, slowest SQL time, duplicate SQL count, hydrated/returned rows, package rows and the zero financial/visit calculation counters. The query log is disabled in `finally`; production (`APP_DEBUG=false`) ignores the flag and exposes no diagnostics.

Example staging request (use an authenticated browser session and an authorized Branch):

```text
/api/proxy/pos/appointments/calendar?store_location_id=12&from_date=2026-08-01&to_date=2026-08-31&per_page=500&profile=1
```

1. In DevTools Network with Preserve log, record Status, Waiting/TTFB, Content Download and the returned profile block.
2. Record the slowest SQL and bindings locally from the request-scoped query log while avoiding customer values in shared logs.
3. In staging PostgreSQL, run `EXPLAIN (ANALYZE, BUFFERS)` for the emitted count and page SQL using representative bindings. Confirm the Branch/date index is selected (or document why the planner prefers another index), actual rows, removed rows, sort method/memory, buffer hits/reads and execution time.
4. Repeat for specific PNG, another authorized Branch, accessible All scope, Staff/customer/search/status filters, a month with 300+ rows, and pages 1/2 at a smaller page size.

No local before/after wall-clock or PostgreSQL plan is claimed: this container has no installed Composer dependencies or reachable representative database. The measured-in-test target is the constant query budget and page hydration count; real response time, SQL time and buffers remain a staging release gate. A normal representative month should be sub-second to a few seconds, not tens of seconds.

## All Branches appointment overview (2026-08-30)

POS Appointments now supports the virtual **All Branches** Header scope for calendar visibility. The previous frontend guard required a real Header Branch because it reused the Header-scoped Cash Shift gate for both booking management and checkout. That coupled a read-only cross-Branch schedule to a single operational drawer even though All Branches is not a persisted or cash-operational Branch.

The workspace continues to issue one bounded `GET /api/pos/appointments/calendar` request. In All scope it omits `store_location_id`; Laravel derives the authenticated user's accessible locations with `StoreLocationAccessService` and applies one `WHERE store_location_id IN (...)` query. It does not fan out per Branch or return to the heavyweight detail DTO. The existing explicit compatibility policy remains: attributed inaccessible rows are excluded, while legacy NULL bookings appear only in All and serialize as Unassigned; a specific Branch excludes NULL.

Calendar rows serialize persisted `store_location_id` plus authorized Branch name/code. Month previews and day appointment blocks display a compact Branch marker only in All scope. Staff remains one identity/column, so a Staff assigned to multiple Branches is not duplicated; the appointment badge supplies the persisted booking context.

Direct detail and appointment actions remain usable without changing the Header, subject to the same action-specific shift policy as specific-Branch mode. Controllers authorize the persisted `bookings.store_location_id`; a client Header cannot replace ownership. Edit Settlement service discovery and reschedule availability explicitly use that persisted Branch. Reschedule remains inside the booking Branch and this change introduces no cross-Branch movement.

All Branches never owns a Cash Shift. Checkout/finalize and package consumption resolve the appointment's persisted Branch and require an open shift at that exact Branch. A shift at another Branch cannot satisfy the action. Missing shifts return a Branch-specific error, and legacy NULL bookings fail safely because no deterministic drawer exists. The UI performs the same per-appointment Branch lookup without switching the Header or opening a shift. ALL defines no new action eligibility: each selected appointment mirrors the existing specific-Branch policy using its persisted Branch. Mark Completed, cancel, no-show, late cancellation, service-photo management, checkout/finalization, and package consumption retain their existing open-shift gate. Edit Settlement, reschedule, confirmation email, and payment-link actions retain their existing no-shift policy. Payment-link behavior remains independent of Cash Shift ownership.

Cash shifts remain operational per Branch: the existing controller can hold an open shift for each Branch, while each lookup and appointment cash action selects the exact Branch. No global/All shift, Staff inference, automatic Header switch, or automatic shift creation was added.

### Appointment action-policy parity correction (2026-08-30)

ALL is visibility/navigation only. The action matrix below is copied from the pre-ALL specific-Branch UI policy; ALL substitutes the selected appointment's persisted Branch Cash Shift state without changing eligibility.

| Action | Existing specific-Branch policy | ALL behavior |
| --- | --- | --- |
| Mark Completed | Open shift required | Same; appointment Branch shift required |
| Checkout / collect payment / zero settlement | Open shift required | Same; appointment Branch shift required |
| Apply/manage package during settlement | Open shift required | Same; appointment Branch shift required |
| Cancel / No Show / Late Cancellation | Open shift required by the existing appointment workspace | Same; appointment Branch shift required |
| Service-photo management | Open shift required by the existing appointment workspace | Same; appointment Branch shift required |
| Cancellation-request approve/reject | Open shift required by the existing workspace | Remains unavailable in ALL because that list action has no single selected appointment context |
| Edit Settlement | No shift gate | Remains available with persisted Branch authorization/scope |
| Reschedule | No shift gate | Remains available and scoped to persisted Branch |
| Send confirmation email | No shift gate | Remains available |
| Payment links/history | No shift gate | Remains available |

The backend now enforces the appointment-Branch shift for Mark Completed as well as checkout/finalization and package consumption. A missing shift, a shift at another Branch, or a legacy NULL Branch cannot satisfy a guarded action. The frontend uses the same per-appointment lookup in both specific and ALL Header scopes, so selecting the same Booking produces the same guarded button state without switching the Header.
