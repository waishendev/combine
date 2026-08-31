# POS Appointments List — Query Optimization (P0 + P1-A + P1-B)

**Date:** 2026-07-31 / 2026-08-01  
**Endpoint:** `GET /api/pos/appointments` → `PosController::appointmentSearch`  
**Frontend:** `frontend/ecommerce_gentlegurl_crm` → `/pos/appointments` (unchanged)  
**Goal:** Speed up the production list path **without** changing business flow, API shape, filters, sorting, pagination, financials, or statuses.

---

## Verdict

| Check | Result |
|--------|--------|
| Production flow (enrich-all → PHP filter → `forPage`) | Unchanged |
| API response keys / pagination shape | Unchanged |
| Financial / status field values (tested July sample) | Unchanged (byte-stable SHA on that request) |
| Frontend / 5s auto-refresh | Unchanged |
| P1-A + P1-B correctness | Verified via unit tests + local payload SHA on the benchmark request |

**Local benchmark only** (`from_date=2026-07-01&to_date=2026-07-31&per_page=500`, 17 appointments). The **−44%** figure below is a **local query-count** reduction. Production latency improvement is **expected** (fewer round-trips) but **not yet proven** — confirm after deploy.

| Stage | Median SQL queries (local) | Δ vs local baseline |
|--------|--------------------|---------------|
| Baseline (before this work) | **505** | — |
| After P0 (indexes + sargable dates) | ~505 | plan quality only; N+1 unchanged |
| After P1-A (request memo) | **351** | **−154 (−30%)** |
| After P1-B (batch active `order_items`) | **284** | **−221 (−44%)** vs baseline |

For **this same July 2026 dataset and those benchmark params**, payload SHA stayed identical across stages (not a claim that every production filter/date combination was byte-verified):

`1c12646324986a6af631be7de18640920f6d7294916c10e70e548c342c127a82`

Appointment IDs for that request: `[1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21]`

---

## What was NOT changed (production flow preserved)

These were deliberately left alone:

1. **Control flow** — still: load month candidates → enrich every row → PHP-side filter → paginate with `forPage`.
2. **API contract** — same JSON keys (`data`, `current_page`, `last_page`, `per_page`, `total`, `pending_cancellation_requests_count`, etc.).
3. **Business rules** — deposit / settlement / addon / package / staff-split / visit-checkout math still uses the same helpers and thresholds.
4. **Frontend** — no CRM page changes; refresh interval untouched.
5. **No Redis / static / cross-request cache** — memo + preload are request-scoped only and cleared in `finally`.
6. **P1-C / P1-D / P1-E** — not implemented (refunds/splits batch, visit meta batch, packages batch). Waiting for explicit approval.

---

## P0 — Indexes + sargable `start_at` (foundation)

### Problem
- `whereDate('start_at', …)` forced Postgres Seq Scan (non-sargable).
- Missing indexes on hot join columns used during enrichment.

### Changes

| File | Change |
|------|--------|
| `database/migrations/2026_07_31_000100_add_pos_appointment_list_indexes.php` | `CREATE INDEX CONCURRENTLY` on Postgres (`$withinTransaction = false`): `order_items(booking_id, line_type)`, `order_service_items(booking_id)` |
| `app/Support/PosAppointmentStartAtFilter.php` | Shared sargable range helper (`>= start`, `< next day`) |
| `PosController.php` | Date filters use sargable ranges instead of `whereDate` |
| `tests/Unit/PosAppointmentStartAtFilterEquivalenceTest.php` | Equivalence vs old `whereDate` semantics |

### Timezone note (kept safe)
- `bookings.start_at` = `timestamp without time zone`
- App TZ `Asia/Shanghai`; PG session `Asia/Kuala_Lumpur` (both UTC+8)
- Values stored as business wall-clock; frontend sends local `Y-m-d`
- Equivalence tests at midnight / 23:59 / month edges / +08 boundary: **MATCH**

P0 improves plan quality for date filtering; it does **not** remove the N+1 enrichment cost (that is P1).

---

## P1-A — Request-scoped memoization (lowest risk)

### Problem
Within a single booking enrichment, the same helpers were called many times:
- staff splits ×2
- package claims ×3
- POS cart service item IDs ×4–5
- visit finalized ×2

Each call re-hit the DB.

### Change
Only while `appointmentSearch` runs (`begin` → `try` → `finally end`):

| Memo key pattern | Helper |
|------------------|--------|
| `staff_splits:{bookingId}:fallback:{fallbackStaffId}` | `resolveBookingStaffSplits` |
| `pos_cart_ids:{bookingId}` | POS cart service item IDs |
| `pkg_claims:{bookingId}:svc:{serviceId}:addons:{md5}` | `resolvePerLinePackageClaims` |
| `visit_finalized:{bookingId}` | `appointmentVisitCheckoutFinalized` |
| `staff_fallback:{staffId}` | staff fallback row |

### Safety
- Cleared after every request (`finally`).
- Other POS endpoints do not use this memo.
- Same callable bodies — only “run once per key per request”.

### Test
`tests/Unit/PosAppointmentSearchMemoTest.php`

### Measured impact
**505 → 351 queries (−154)** on the local July benchmark request. Payload SHA unchanged for that request only.

---

## P1-B — Batch-load active `order_items`

### Problem
`resolveAppointmentFinancialSummary` ran up to **4** `activeBookingOrderItemQuery` calls per booking:
1. `booking_addon`
2. `booking_deposit`
3. `booking_addon` + `variant_name_snapshot = 'Booking Add-on Deposit'`
4. `booking_settlement`

Each query used `whereHas('order', …)` → expensive correlated existence checks.

### Change
1. After `$builder->…->get()`, once:
   `preloadAppointmentSearchActiveOrderItems($bookingIds)`
2. One SQL: all active `order_items` for those booking IDs with  
   `line_type IN (booking_addon, booking_deposit, booking_settlement)`  
   and parent order status `NOT IN (voided, cancelled, draft)` — same rules as before.
3. In enrichment, those four call sites use  
   `activeBookingOrderItemsFiltered($bookingId, $lineType, $variant?)`  
   which filters the in-memory collection when preload is active; otherwise falls back to the original query (other endpoints unchanged).

### Safety
- Same order-status filter and line types.
- Same amount helpers afterward.
- Preload map cleared with P1-A memo `end`.
- Non–appointment-search code paths keep original `activeBookingOrderItemQuery`.

### Test
`tests/Unit/PosAppointmentActiveOrderItemsBatchTest.php`

### Measured impact
**351 → 284 queries (−67)** on the local July benchmark request. Payload SHA unchanged for that request only.  
Local re-check (2026-08-01): `query_count=284`, `sha_match=true`, `ids_match=true`, response keys unchanged.  
Batch preload queries: **1**. Remaining per-booking `whereHas` on `order_items` (~26) are from other paths (e.g. refund/split lookups) — left for P1-C+.

---

## Cumulative performance analysis

### Query count (local primary metric)

```
Baseline ████████████████████████████████████████████████████  505
P1-A     ███████████████████████████████████                   351   (−30% local)
P1-B     ████████████████████████████                          284   (−44% local vs baseline)
```

These percentages are **local query-count** reductions on the July sample. They are **not** measured production latency.

### Wall / DB time (local, noisy — use as directional)

On the same July request (`from_date=2026-07-01&to_date=2026-07-31&per_page=500`), after P1-B:
- Median wall ≈ **~1.1–1.5 s** (machine load varies; single warm run can be higher)
- Median DB time ≈ **~340 ms** (earlier P1-B benchmark set)

**Interpretation:** Local query count is the reliable evidence of less work on this dataset. Local wall clock fluctuates. Production should see latency improvement from fewer Postgres round-trips, but that still needs **post-deployment verification** — it has not been proven in production yet.

### Why it is still not “instant”
Enrichment still does per-booking work for:
- refund / staff-split related queries (candidate **P1-C**)
- visit checkout meta (candidate **P1-D**)
- package / cart resolution beyond memo (candidate **P1-E**)

Those are **not** shipped yet on purpose.

---

## Files touched (summary)

### Backend code
- `app/Http/Controllers/Ecommerce/PosController.php` — sargable dates, memo begin/end, preload, filtered order-item reads
- `app/Support/PosAppointmentStartAtFilter.php` — new helper

### Migrations
- `database/migrations/2026_07_31_000100_add_pos_appointment_list_indexes.php`

### Tests
- `tests/Unit/PosAppointmentStartAtFilterEquivalenceTest.php`
- `tests/Unit/PosAppointmentSearchMemoTest.php`
- `tests/Unit/PosAppointmentActiveOrderItemsBatchTest.php`

### Frontend
- None

---

## Verification checklist (run / re-run)

```bash
cd backend/ecommerce_gentlegurl_backend_api
php vendor/phpunit/phpunit/phpunit --filter "PosAppointmentSearchMemoTest|PosAppointmentActiveOrderItemsBatchTest|PosAppointmentStartAtFilterEquivalenceTest"
```

Expected: **12 tests, OK**.

Local smoke (same params as the July benchmark only):
- Query count ≈ **284** (for that sample size ~17)
- Payload SHA = `1c126463…127a82` (this request/dataset only)
- IDs = `[1,2,6,7,8,9,10,11,12,13,14,15,16,17,18,19,21]`

After deploy: re-measure production latency / query volume; do not treat the local −44% as proven prod latency.

---

## Next steps (not done — need approval)

| Phase | Intent | Risk |
|-------|--------|------|
| **P1-C** | Batch refunds / staff-split related lookups | Medium |
| **P1-D** | Batch visit checkout meta | Medium |
| **P1-E** | Batch package / cart resolution | Medium–higher |

> **Update (2026-08-31):** Follow-on work shipped as **`pos-appointments-query-v2`** — see  
> `POS_Checkout_Appointments_Query_Enhancement_2026_08_31.md`  
> (calendar feed, SQL pagination, `lite=1`, Request Center summary, package/staff/cart/deposit batching). Several former P1-C/D/E items are covered there.

Rule: ship one phase at a time; require payload SHA / business-field equality on a defined test request before merging.

---

## Bottom line

P0 + P1-A + P1-B only remove **duplicate / N+1 SQL** on the appointments list. They do **not** reorder filters, change pagination, or alter money/status logic. On the **local July 2026 benchmark request**: **−44% SQL queries** and an **identical payload SHA** for that dataset/params. Treat this as a safe acceleration of the existing production flow; **confirm real-world latency after deployment**.
