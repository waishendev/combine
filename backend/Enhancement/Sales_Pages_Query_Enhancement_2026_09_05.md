# Sales Pages — Query Enhancement (2026-09-05)

Enhancement id: `sales-pages-query-v1`

**CRM pages**
- `/reports/sales` — sales-summary (already light; routes tagged)
- `/reports/sales/daily` — shares visual-daily + ecommerce/booking
- `/reports/sales/visual-with-void` — same APIs as visual + `include_void`
- Also speeds `/reports/sales/visual` (same services)

**Builds on:** `Sales_Visual_Report_Query_Optimization_P0.md` (booking N+1 + indexes).  
This ships the deferred **P1 gateway batch** plus package-claim / summary folds.

**Constraint:** Same JSON shapes, filters, package-claim math, gateway variants, refund channels.

**Environment:** Local Postgres · orders=1,032 · median of 5.

---

## Verdict

| Path | Before | After | Delta |
|------|--------|-------|-------|
| `visual-daily/all` 90d wall | **~839 ms** | **~90 ms** | **−89%** |
| `visual-daily/all` 90d queries | **36** | **24** | **−33%** |
| `visual-daily/all` 90d include_void | ~929 ms | **~92 ms** | **−90%** |
| `visual-daily/all` today | ~68 ms / 31 q | **~31 ms / 17 q** | −54% / −14 q |
| ecommerce/booking list clones | +2 SUM each | folded into summary | −2 q each |
| sales-summary year | ~18 ms / 5 q | ~15 ms / 5 q | already OK |

---

## What landed

### P0 — Precompute package-claim booking IDs
- `bookingIdsWithPackageClaimRedemption($settledBookingIds)` once per staff/item-type path
- `excludePackageRefundedBookingDeposits(..., $ids)` uses `OR NOT IN` instead of correlated EXISTS + redemption scalar per row
- Same “min usage id / redemption > 0” rule

### P0 — Gateway payment methods: one grouped scan
- `sumOrderNetAmountsGroupedByGateway` → group by effective method + online/offline
- PHP rolls up via `paymentMethodVariantsForMatch` (preserves overlapping-variant behavior)
- Replaces ~12–14 per-key SUMs for all / ecommerce / booking workspaces

### P1 — Refund cards + channel summary folds
- `refundRows`: one `GROUP BY method, channel`
- `SalesChannelReportService` ecommerce/booking: fold `product_amount` / `gross` / `discount` into the existing summary aggregate

### Routes marked
`routes/api.php`: sales-summary, visual-daily/*, sales/ecommerce, sales/booking  
`// NEW ENHANCEMENT — sales-pages-query-v1`

---

## Deploy notes
1. No new migration (indexes from Visual P0 already cover bill_at / staff splits / csp usages).
2. Smoke `/reports/sales/daily` and `/reports/sales/visual-with-void` All mode on a 90-day window.
3. Spot-check payment method card totals vs a known day.

---

## Trade-offs
- Gateway batch loads all method buckets then maps in PHP (small memory; far fewer round-trips).
- Package-claim precompute adds one DISTINCT query when settled bookings exist; removes catastrophic correlated work.

---

## Related docs
- Review: `Sales_Pages_Query_Performance_Review_2026_09_05.md`
- Prior: `Sales_Visual_Report_Query_Optimization_P0.md`
