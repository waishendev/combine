# Phase 9F — POS/Appointments request-lifecycle hardening

**Classification:** Phase 9 enhancement/hardening (not Phase 10)  
**Scope:** CRM POS checkout and POS Appointments; existing multi-Branch authorization is unchanged.

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
