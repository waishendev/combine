# Sales Pages — Query Enhancement v1b (2026-09-05)

Enhancement id: `sales-pages-query-v1b`  
Extends: `sales-pages-query-v1`

**CRM pages:** `/reports/sales`, `/reports/sales/daily`, `/reports/sales/visual`, `/reports/sales/visual-with-void`

**Constraint:** Same JSON / formulas / gateway variants / package-claim rules. Request-scoped memo only (no Redis / static cache).

**Environment:** Local Postgres · orders=1,032 · median of 5.

---

## Verdict

| Path | After v1 | After **v1b** | Delta vs v1 |
|------|----------|---------------|-------------|
| `visual-daily/all` **90d** | ~90 ms / **24** q | **~79 ms / 20 q** | **−4 q · ~−12% wall** |
| `visual-daily/all` today | ~31 ms / 17 q | **~26 ms / 14 q** | −3 q |
| `sales/booking` 90d | ~51 ms / 16 q | ~51 ms / 16 q | unchanged (list path) |

Relative to **pre-v1** (~839 ms / 36 q on 90d): still **~−90% wall / −16 queries**.

Sample 90d totals unchanged shape: `product=339.7`, `package_redemption=0`, payment online present.

---

## What v1b adds

### 1) Request memo — settled bookings + package-claim IDs
`allPeriod` called both `bookingStaffCommissionSales` and `bookingServiceItemTypeAmount`, each re-plucking settled IDs and re-running the DISTINCT package-claim scan (**2×**).

- `settledBookingIdsInRange()` — memo on `request()->attributes`
- `bookingIdsWithPackageClaimRedemption()` — memo keyed by sorted booking-id set

### 2) Request memo — staff roster
`salesReportStaffRoster()` shared across ecommerce/booking staff pads in one request.

### 3) `allPeriod` item-type aggregate fold
Merged product/service/`service_package` into **one** `CASE` aggregate (same numbers as ecommerce scan + booking package scan). Avoids double-counting package by keeping a single `service_package` bucket (matches prior sum of the two queries).

### 4) Package redemption SUM prefilter
Only rows that can contribute (settlement|addon, net≈0, gross>0, ids present) enter the correlated usage lookup — same CASE math, fewer subquery evaluations.

### 5) Payment gateways — one `whereIn(type)`
`paymentMethodsForAllWorkspace` loads ecommerce+booking gateways in a **single** query (was two).

---

## Still not worth touching (for now)

| Area | Why leave |
|------|-----------|
| `effectiveBookingLineTotalExpr` jsonb options | Correctness-sensitive; ~5–8 ms locally after v1 |
| Booking list (~16 q) | P0 batch already in place; remaining work is pagination + payments |
| sales-summary | Already ~15 ms / 5 q |

---

## Deploy
No migration. Deploy PHP only. Smoke 90-day All mode on daily / visual / with-void.

---

## Files
- `app/Services/Reports/SalesVisualDailyReportService.php`
- `routes/api.php` tagged `sales-pages-query-v1 / v1b`
- Prior: `Sales_Pages_Query_Enhancement_2026_09_05.md` (v1)
