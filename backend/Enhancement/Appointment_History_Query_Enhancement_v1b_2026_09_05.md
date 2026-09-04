# Appointment History — Query Enhancement v1b ANALYSIS (2026-09-05)

Enhancement id: `appointment-history-query-v1b`  
**Builds on:** `appointment-history-query-v1` / `Appointment_History_Query_Enhancement_2026_09_05.md`

**Constraint:** Same JSON shapes, payment-status semantics, filters, UX.

**Environment:** Local Postgres · bookings=724 · median of 5.

---

## Verdict

| Call | After v1 | After v1b | Notes |
|------|----------|-----------|-------|
| List page 1 | ~158 ms / **23 q** | **~152 ms / 19 q** | −4 queries; wall still ~PHP financial summary |
| `payment_status=paid` 90d | ~4.0–5.0 s / **109 q** | **~4.3 s / 47 q** | −57% queries; wall still O(n) CPU |
| List SQL time | ~19 ms | **~15 ms** | Duplicate package lookup removed |

Default list: **~15 ms SQL + ~175 ms PHP** for 25 rows. Further wall cuts need a lighter financial path or cached payment status — not safe to approximate without product sign-off.

---

## What landed in v1b

### 1. Remove duplicate cart package-usage query
`resolveAppointmentFinancialSummary` re-queried POS-cart usages after `resolveAppointmentPackageUsageEarly` already applied the same fallback. Removed the second query (behavior unchanged when early is null).

### 2. Memo `appointmentFinancialSummaryForBooking`
Request-local `fin_summary:{id}` under the preload window so repeat calls in the same batch are free.

### 3. `payment_status`: status-only pass + full map page
- `filterHistoryBookingsByPaymentStatus` computes `computed_payment_status` only (no service-block / staff-name response shaping)
- Chunk size 250 for the scan
- `mapHistoryBookings` runs only for the requested page
- Totals / last_page semantics unchanged

### 4. Skip package eligibility in history preload window
History list/detail mapping does not expose `can_apply_package` / `eligible_package_count`.  
`withAppointmentFinancialPreload` sets `appointmentFinancialSummarySkipEligibility` and skips package-balance preload (empty map → eligibility counts stay 0).  
`appointmentSearch` path unchanged (still preloads balances + full eligibility).

### Routes
`api.php` tag updated to `appointment-history-query-v1 / v1b`.

---

## Why payment_status is still ~4s

Filter must evaluate financial summary for **every** matching booking to keep accurate `total`. Locally that is ~700× PHP settlement math. SQL is no longer the bottleneck (~47 queries).

**Deferred (real next leap):** persist / maintain `computed_payment_status` (or equivalent) on write paths → SQL `WHERE` + normal `paginate`.

---

## Deploy notes
1. No new migration (v1 indexes already applied).
2. Smoke payment filters paid/unpaid/partial vs known bookings; confirm totals match v1.
3. Spot-check list amounts / package claims unchanged on a page of rows.

---

## Trade-offs
- History financial summary under preload omits eligibility fields (not in history API response).
- Status pass still runs full settlement math per booking (required for correct filter).
- Page rows remapped after filter (second preload for ≤25 rows) — cheap vs mapping all rows.
