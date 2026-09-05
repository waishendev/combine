# Appointment Activity Logs + Customer Service Packages — Query Performance Review (2026-09-05)

**Scope**

| Page | Client | Primary APIs |
|------|--------|--------------|
| `/appointments/activity-logs` | `AppointmentActivityLogTable` | `GET /api/admin/appointment-activity-logs` → `ActivityLogController@appointmentIndex` |
| `/booking/customer-service-packages` | `CustomerServicePackagesPage` | `GET /customers?per_page=100` + `…/service-packages` + `…/balances` + `…/usages` |

**Constraint:** Analysis only. No business logic / API shape / UX changes in this pass.

**Environment:** Local Postgres · `activity_logs`=8,933 (Booking=4,455) · CSP packages=1 / balances=0 / usages=0 · customers=661 · median of 5.

**Related (not these pages):** `/activity-logs` ecommerce CRUD logs and `/booking/logs` (`booking-logs-query-v1`) are separate tables/routes.

**Parked (out of scope):** `computed_payment_status` plan for appointment-history remains deferred.

---

## ACTION / navigation analysis (requested)

### Appointment Activity Logs — Action column

| UI element | Behavior | Navigates elsewhere? |
|------------|----------|----------------------|
| **Action** badge | Display-only label from `AppointmentActivityLogService::ACTIONS` | **No** |
| **Action** filter `<select>` | Filters list by `action=` query param | **No** (same page API) |
| Booking ID cell | Plain text (`booking_number`) | **No link** |
| Performed By | Text | **No** |
| Row click / drawer / detail API | None | — |

**Static action catalog (filter + badge labels):**

| Key | Label |
|-----|--------|
| `appointment.rescheduled` | Rescheduled Appointment |
| `appointment.cancelled` | Cancelled Appointment |
| `appointment.no_show` | Marked as No Show |
| `appointment.late_cancelled` | Marked as Late Cancellation |
| `appointment.completed` | Marked as Completed |
| `appointment.checked_out` | Checked Out Appointment |
| `appointment.email_queued` | Confirmation Email Queued |
| `appointment.package_applied` | Applied Package |

These are **audit event types**, not deep-links. If product later links Booking ID → e.g. `/booking/appointment-history` detail (`historyShow`), that target was already reviewed under appointment-history (detail ~29–40 ms); **not in scope to change here**.

### Customer Service Packages — actions

| UI element | Behavior | Navigates elsewhere? |
|------------|----------|----------------------|
| Customer `<select>` | Loads 3 package APIs for selected id | **No** other CRM route |
| Refresh | Re-fetches same 3 APIs | **No** |
| Package / balance / usage tables | Read-only | **No row actions, no links** |
| Breadcrumb Link | Self (`/booking/customer-service-packages`) | Same page |

**Conclusion:** Neither page has ACTION buttons that open other CRM pages. No secondary page APIs need to be included in this review for click-through. Remaining notes are **list/query** hotspots only.

---

## Executive summary

| Call | Wall (median) | Queries | Verdict |
|------|---------------|---------|---------|
| Appt activity logs page 1 (branch) | **~17 ms** | 5 | Healthy locally; watch EXISTS + facets at scale |
| Appt logs page 1 · 90d | ~20 ms | 5 | OK |
| Appt logs page 2 (no user facet) | ~15 ms | 4 | OK |
| Appt logs `search=a` | ~20 ms | 5 | OK now; leading `%` ILIKE + JSON path risk at scale |
| Appt logs `action=checked_out` | ~19 ms | 5 | OK; plan filters many non-matching rows |
| Customers dropdown `per_page=100` | **~60 ms** | 6 | Heaviest CSP-page cost locally |
| CSP `index` / `balances` / `usages` (cust 648) | ~1–5 ms | 1–3 | Trivial on empty/near-empty local CSP data |

Local CSP volume is near zero — treat structural risks (unbounded `get()`, over-eager loads, heavy customer list) as the production concern.

---

## 1) Appointment Activity Logs

### Call path

```
/appointments/activity-logs
  └─ GET /api/proxy/admin/appointment-activity-logs
       └─ ActivityLogController::appointmentIndex
            table: activity_logs (model_type=Booking)
```

Not covered by `booking-logs-query-v1` (`booking_logs` / `/admin/booking/logs`).

### What the query does

- Filter: `model_type = Booking`, `action IN` appointment action keys, branch via **`whereExists` → `bookings.store_location_id`**, optional action / user / booking_number / search / sargable date range.
- Order: `created_at DESC`; paginate (default 25).
- Page 1 / `include_filters`: DISTINCT `user_id, user_name` with same EXISTS (actions facet is **static PHP**, no SQL).
- Response maps only id / booking_number / action / actor / created_at — but SQL still selects **`old_values` / `new_values` / `ip_address`**.

### EXPLAIN (branch list LIMIT 25)

```text
Index Scan Backward activity_logs_created_at_index
  Filter: model_type = 'Booking'   ← strips non-Booking rows
Nested Loop → bookings_pkey Memoize (store_location_id filter)
Execution Time: ~0.21 ms
```

Action-filtered plan similarly walks `created_at` index and **filters** `action` + `model_type` (146 rows removed before 25 kept). Locally fine; at large volume this over-reads.

### Root causes / recommendations

| Priority | Issue | Why | Safe fix | Trade-off |
|----------|-------|-----|----------|-----------|
| P1 | Missing `(model_type, created_at DESC)` (and optionally `(model_type, action, created_at DESC)`) | Default list always filters Booking + sorts by time; action filter still post-filters on `created_at` scan | Add composite index(es) | Extra storage / slightly slower activity_log inserts |
| P1 | SELECT includes jsonb `old_values`/`new_values` unused by this UI | Extra I/O per row | Narrow select / map-only columns for appointmentIndex | Must keep columns if a future drawer needs them — additive API ok |
| P2 | Branch `whereExists` on every COUNT + page + facet | Correct scoping; Nested Loop is OK with PK lookup | Keep; optional denormalize `store_location_id` onto activity_logs if EXISTS dominates in prod | Schema/write-path change |
| P2 | Leading-wildcard `ilike` + `new_values->>booking_number` | Hard to index | Prefer exact / prefix booking_code; expression index only if search is hot | Write cost for expression index |
| P2 | DISTINCT users facet on page 1 | Extra scan with EXISTS | Already skipped on page>1; cache short TTL or static actor list if slow | Stale actors until refresh |
| Low | Payload still ships unused fields in SQL | — | Align SELECT with mapped keys | — |

**Already good:** sargable date bounds (`applyCreatedAtDayRange`); static actions facet; pagination; landing-page activity-logs indexes for generic CRUD actions partially help `action` paths.

---

## 2) Customer Service Packages

### Call path

```
/booking/customer-service-packages
  ├─ GET /customers?per_page=100          → CustomerController@index (dropdown)
  └─ on customer select (parallel):
       ├─ GET /customers/{id}/service-packages   → ::index   → get() all
       ├─ GET /customers/{id}/service-package-balances → ::balances → get() all
       └─ GET /customers/{id}/service-package-usages   → ::usages → get() all
```

### Root causes / recommendations

| Priority | Issue | Why | Safe fix | Trade-off |
|----------|-------|-----|----------|-----------|
| **P0** | Customer dropdown uses full `/customers?per_page=100` | ~60 ms / 6 q locally; loyalty aggregates etc. unused by select | Slim `customers/options/query` (id/name/phone) like other CRM pages | Need options endpoint permission aligned with CSP view |
| **P0** | Three endpoints use **`->get()` with no pagination** | Fine for tiny histories; dangerous for power users with large usage logs | Paginate usages (and optionally packages/balances) with same JSON shape + `meta`, **or** soft `limit` with “load more” (UX change — needs product OK) | Pagination is API-additive if wrapped carefully |
| P1 | `index` eager-loads `balances.bookingService` while UI packages table only shows package name/status/dates | Extra joins | Slim `with(['servicePackage:id,name'])` for this endpoint | If other clients use full graph, add `?include=` or leave as-is |
| P1 | `usages` eager-loads `booking` but FE never shows booking | Dead weight | Drop `booking` from with() for this page’s contract | Confirm no other consumer of this route |
| P1 | `balances` uses `whereHas(customerServicePackage)` | Subquery; OK with indexes | Prefer `whereIn(customer_service_package_id, …)` from customer packages | Slightly more PHP |
| P2 | No dedicated `(customer_id, id DESC)` on usages | Current `(customer_id, booking_service_id)` still used (EXPLAIN Index Cond on customer_id) | Optional covering sort index if usages lists grow huge | Write cost |
| Note | Same controller `availableFor` has **per-row reserved SUM** N+1 | **Not called by this page** (POS); flag for later | Batch reserved qty | — |

**Indexes present:** `customer_service_packages (customer_id, status)`; usages `(customer_id, booking_service_id)` + status/booking indexes — adequate for customer-scoped reads today.

---

## Suggested verification (when implementing)

1. Re-bench appointment activity logs with/without `(model_type, created_at DESC)` under production-like row counts.
2. CSP: pick a customer with large usage history in staging; compare unbounded `usages` wall vs paginated.
3. Confirm no FE consumers of CSP endpoints need the dropped relations before sliming `with()`.

---

## Appendix — bench command

```text
php storage/app/_bench_appt_logs_csp.php
```
