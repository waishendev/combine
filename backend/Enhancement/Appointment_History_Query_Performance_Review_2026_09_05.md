# Appointment History — Query Performance Review (2026-09-05)

**Scope**

| Surface | Client | Primary APIs |
|---------|--------|--------------|
| `/booking/appointment-history` | `BookingAppointmentHistoryPage` | `GET /api/admin/booking/appointment-history` → `AppointmentController@history` |
| Detail drawer | same | `GET …/appointment-history/{id}` → `historyShow` |
| Staff filter | same | `GET /api/proxy/staffs?per_page=200&is_active=true` |

**Constraint:** Analysis only. **Do not change** business logic, API response shape, or UX unless a follow-up Enhancement is approved.

**Environment:** Local Postgres · bookings=724 · booking_logs=710 · median of 5 controller runs · wall + Laravel query log.

---

## Executive summary

| Call | Wall (median) | Queries | Verdict |
|------|---------------|---------|---------|
| List page 1 · `per_page=25` · branch | **~622 ms** | **509** | Critical — ~20 q/row after pagination |
| List 90d date range · page 1 | **~705 ms** | **509** | Same per-row cost; list SQL itself is cheap |
| List `payment_status=paid` · 90d | **~17.5 s** | **15,142** | Catastrophic — maps **all** matching bookings in PHP |
| List `q=a` | ~603 ms | 530 | Same list mapper + extra `orWhereHas` |
| Detail `historyShow` | **~40 ms** | 36 | Acceptable |

The list **base** SQL (count + page of bookings + eager `service`/`staff`/`customer`/`storeLocation`) is **&lt;2 ms**. Almost all latency is **post-fetch mapping** via `mapHistoryBooking` → `PosController::appointmentFinancialSummaryForBooking` + `resolvePerLinePackageClaims` + per-booking staff splits.

---

## Call path

```
page.tsx
  └─ BookingAppointmentHistoryPage
       ├─ GET /api/proxy/staffs?per_page=200&is_active=true   (filter dropdown)
       ├─ GET /api/proxy/admin/booking/appointment-history     (table)
       └─ GET /api/proxy/admin/booking/appointment-history/{id} (drawer)
```

Backend list (`history`):

1. Branch-scoped `Booking` query; optional `whereDate(created_at)`, staff, status, `q`.
2. If **no** `payment_status` filter: `paginate` → `mapHistoryBooking` × page size.
3. If `payment_status` ∈ {paid, unpaid, partial}: **`$query->get()`** → map **every** row → PHP filter → `forPage`.

---

## Root causes

### 1. Per-row financial / package / split resolution (critical)

`mapHistoryBooking` (≈25× per default page) calls:

- `appointmentFinancialSummaryForBooking` → `resolveAppointmentFinancialSummary` (linked `booking_services`, deposit/settlement math, refunds, order_item / order_service_item existence, staff-split snapshots, package early usage, …)
- `resolvePerLinePackageClaims` → `computePerLinePackageClaims` (usages + POS cart item fan-out)
- `resolveHistoryStaffSplits` → `booking_service_staff_splits` by `booking_id` (+ occasional `staffs` lookups from addon JSON)

Observed query volume on one page of 25 (approx counts):

| Table / pattern | ~Count |
|-----------------|--------|
| `order_items` | 125 |
| `customer_service_package_usages` | 87 |
| `order_item_staff_splits` | 84 |
| `booking_service_staff_splits` | 75 |
| `staffs` | 46 |
| `booking_services` | 40 |
| `booking_refunds` | 25 |

**Root cause:** N+1 (and N×M) inside shared POS financial helpers reused for a **list** endpoint. Eager-loading on the booking model does not cover these side queries.

**At production scale:** wall time scales roughly with `page_size × queries_per_booking`. With ~20 q/row, 25 rows ≈ 500 queries even when the bookings index scan is perfect.

### 2. `payment_status` filter loads and maps the entire result set (critical)

```php
$rows = $query->orderByDesc('created_at')->orderByDesc('id')->get()
    ->map(fn (Booking $booking) => $this->mapHistoryBooking($booking))
    ->filter(... payment status ...)
    ->values();
// then forPage
```

Local 90d + `paid`: **~17.5 s / 15k queries** on only **724** bookings.  
Production with tens of thousands of bookings makes this filter unusable.

**Why:** `computed_payment_status` is derived in PHP from financial summary + package offsets; it is not a stored/indexed column, so the API correctly (functionally) recomputes it — but it does so for **every** row before pagination.

### 3. List sorted/filtered by `created_at` without a matching composite index (medium at scale)

Existing bookings indexes favor **calendar / status** paths (`store_location_id, start_at, …`, `store_location_id, status, start_at`).  
History uses **`created_at` DESC, id DESC** and `whereDate('created_at', …)`.

`EXPLAIN (ANALYZE, BUFFERS)` locally (716 rows in filter):

| Filter style | Plan | Exec |
|--------------|------|------|
| `DATE(created_at) >=/<=` (`whereDate`) | Seq Scan + top-N sort | ~0.40 ms |
| Sargable `created_at` range | Seq Scan + top-N sort | ~0.28 ms |

Locally cheap because the table is small; both still **Seq Scan**. On large branches, missing `(store_location_id, created_at, id)` forces scan/sort of the branch slice. `DATE(created_at)` also blocks a plain btree range seek even after an index exists.

### 4. Missing index on `booking_service_staff_splits.booking_id` (medium)

Local indexes on that table: **PK only**.  
`resolveHistoryStaffSplits` runs `WHERE splits.booking_id = ?` once per list row (and more for multi-service mappings). At higher split volume this becomes a repeated sequential filter.

### 5. Staff dropdown over-fetch (low)

FE loads full staff list via `/staffs?per_page=200` instead of a slim options endpoint (id/name only). Not the list hotspot, but adds unnecessary payload/work on every page mount.

### 6. Detail endpoint (OK)

`historyShow` (~40 ms / 36 q) is within a reasonable budget for one booking with photos, payments, logs, and the same mapper once.

---

## Missing / recommended indexes

| Index | Why | Trade-off |
|-------|-----|-----------|
| `bookings (store_location_id, created_at DESC, id DESC)` | Matches history list order + branch scope; enables Index Scan / Index Only patterns when combined with sargable `created_at` bounds | Extra storage; slightly slower booking inserts/updates that touch `created_at` (rare after insert) |
| `booking_service_staff_splits (booking_id)` or `(booking_id, id)` | Speeds every list/detail staff-split lookup | Small table typically; low write cost |
| Keep using existing `order_items (booking_id, line_type)`, `customer_service_package_usages (status, booking_id)`, `booking_refunds (booking_id, status)` | Already present; batching still needed so they are hit fewer times | — |

**Not sufficient alone:** indexes will not fix the 500–15k query explosion; they only help the outer list and each individual lookup.

---

## Safe optimization recommendations (behavior-preserving)

Priority order for a future Enhancement (e.g. `appointment-history-query-v1`):

### P0 — Batch / memoize list financial resolution

Reuse patterns already used in POS appointment search (`rememberAppointmentSearch`, preloaded `booking_services` by id, package-claim batching):

- For the **page’s booking IDs** (or the filtered ID set), preload once: order_items, package usages (by booking_id / used_ref), booking_service_staff_splits, booking_refunds, linked booking_services price meta, order_item_staff_splits snapshots.
- Inject into PosController request-scoped maps so `mapHistoryBooking` does not re-query per booking.
- **Must** preserve identical financial fields / `computed_payment_status` for the same inputs (golden-fixture or snapshot tests recommended).

**Expected impact:** drop list from ~500 q → tens of queries; wall from hundreds of ms toward tens of ms locally; larger win in production.

### P0 — Fix `payment_status` pagination strategy without changing semantics

Options (pick one that keeps **exact** filter semantics):

1. **Batched chunk scan:** still filter in PHP, but process IDs in chunks with the same batch preloads, stop once `page * per_page` matches are collected **only if** total/last_page can still be computed correctly (hard without a full pass for `total`).
2. **Full pass with batched map (no per-row SQL):** still O(n) CPU but O(1) round-trips — fixes the 15k-query failure mode; total count stays accurate.
3. **Persisted / cached `computed_payment_status`** (column or materialised side table updated on settle/refund/package claim) — enables SQL `WHERE` + normal `paginate`. Highest leverage long-term; requires write-path maintenance and backfill (behavior risk if cache drifts — needs strong invalidation).

Recommendation for lowest risk first: **(2) batch map over matching IDs**, then evaluate **(3)** if payment filter remains slow on large tenants.

### P1 — Sargable dates + history index

- Replace `whereDate('created_at', …)` with `[from 00:00:00, to 23:59:59.999]` (timezone-aware to match current `whereDate` semantics).
- Add `bookings (store_location_id, created_at DESC, id DESC)`.

### P1 — Index `booking_service_staff_splits(booking_id)`

Low risk, helps list and detail.

### P2 — Slim staff options on FE

Point the dropdown at an existing options/query endpoint (id + name, active only) instead of `/staffs?per_page=200`.

### Avoid

- Changing response JSON keys or payment-status rules.
- Dropping financial accuracy to “approximate” paid/unpaid in SQL without product sign-off.
- Caching list pages across users/branches without branch + auth keys.

---

## EXPLAIN notes (list SQL only)

Outer list query is not the bottleneck today (sub-ms–low-ms locally). Plans show **Seq Scan** on `bookings` for both `DATE(created_at)` and sargable forms at 724 rows. After the history composite index exists and dates are sargable, expect **Index Scan / Backward Index Scan** on large branches; re-run `EXPLAIN ANALYZE` in production-sized data before/after.

---

## Suggested verification plan (when implementing)

1. Median bench: default page, 90d range, `payment_status=paid|unpaid|partial`, search `q`, `historyShow`.
2. Assert response JSON equality for a fixed fixture set of booking IDs (list + detail).
3. `EXPLAIN ANALYZE` on list SQL with production-like row counts.
4. Query-log count by table for page size 25 (target: no linear growth of `order_items` / package usages with page size beyond a small constant factor).

---

## Appendix — bench command

```text
php storage/app/_bench_appointment_history.php
```
