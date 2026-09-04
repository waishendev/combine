# Sales Pages (`/reports/sales`, `/daily`, `/visual-with-void`) — Query Performance Review (2026-09-05)

**Scope**
| Page | Client | Primary APIs |
|------|--------|--------------|
| `/reports/sales` | `SalesSummaryWorkspaceClient` | `GET /ecommerce/reports/sales-summary` |
| `/reports/sales/daily` | `SalesReportDailyDetailClient` | `visual-daily/*` + `sales/ecommerce` + `sales/booking` |
| `/reports/sales/visual-with-void` | `SalesVisualWorkspaceClient` (`includeVoid`) | same as `/reports/sales/visual` + `include_void=true` |

**Prior Enhancement:** `Sales_Visual_Report_Query_Optimization_P0.md` documents **`/reports/sales/visual` only**.  
Backend P0 (booking package-meta batch + indexes) already applies to **daily** and **visual-with-void** because they share those APIs.  
**`/reports/sales` (sales-summary)** was not called out and needed its own look — it was already light (~3 aggregates).

**Constraint:** Analysis + safe opts shipped as `sales-pages-query-v1` (see Enhancement ANALYSIS).  
**Environment:** Local Postgres · orders=1,032 · order_items=2,279 · gateways=8 · median of 5.

---

## Coverage verdict (your question)

| Page | Covered by Visual P0 doc? | Already shared P0 backend? | Needed more work? |
|------|---------------------------|----------------------------|-------------------|
| `/reports/sales/visual` | **Yes** (doc target) | Yes | P1 deferred (gateway) |
| `/reports/sales/visual-with-void` | **No** (same client) | **Yes** (same APIs + `include_void`) | Same remaining P1 |
| `/reports/sales/daily` | **No** | **Yes** (visual-daily + channel tables) | Same remaining P1 |
| `/reports/sales` | **No** | Partial (indexes only) | Already OK; no hotspot |

So: P0 doc ≈ visual only, but **daily / with-void were not “unenanced” at the API layer** — they ride the same services. The remaining gap was Visual P1 + package-claim correlated EXISTS on long ranges.

---

## Executive summary (before → after `sales-pages-query-v1`)

| Call | Before | After |
|------|--------|-------|
| `sales-summary` year | ~18 ms / 5 q | ~15 ms / 5 q |
| `visual-daily/all` today | ~68 ms / 31 q | **~31 ms / 17 q** |
| `visual-daily/all` **90d** | **~839 ms / 36 q** | **~90 ms / 24 q** |
| `visual-daily/all` 90d `include_void` | ~929 ms / 36 q | **~92 ms / 24 q** |
| `sales/ecommerce` 90d | ~23 ms / 10 q | ~20 ms / 8 q |
| `sales/booking` 90d | ~55 ms / 18 q | ~51 ms / 16 q |

---

## Root causes (90d visual-daily hotspot)

### 1. Package-claim correlated EXISTS (critical)

`excludePackageRefundedBookingDeposits()` embedded `packageRedemptionLineValueExpr` in a per-row `NOT EXISTS`.  
Staff split + fallback + item-type paths each re-evaluated it → **three ~245 ms** queries locally.

### 2. Per-gateway × online/offline SUM (medium — Visual P1)

`paymentMethodsForAllWorkspace` ran **~12–14** heavy allocated-payment scans (~2–4 ms each).

### 3. Refund cards 4× SUM (low)

`refundRows()` cloned 4 `SUM(amount)` queries.

### 4. Channel list extra clone aggregates (low)

`ecommerce()` / `booking()` re-scanned `product_amount`/`gross`/`discount` after summary.

### 5. sales-summary

Already **3 bucketed aggregates** (+ branch scope). Healthy; no rewrite required.

---

## Safe recommendations (shipped)

See `Sales_Pages_Query_Enhancement_2026_09_05.md`.
