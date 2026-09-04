# Profit & Loss + Cash Shifts — Query Performance Review (2026-09-04)

**Scope**
- CRM `/reports/profit-loss` — `ProfitLossReportPage` → `GET /api/admin/reports/profit-loss`
- CRM `/reports/cash-shifts` — `CashShiftReportPage` → `GET …/cash-shifts` + `GET …/cash-shifts/summary`

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · orders=1,032 · order_payments=904 · expenses=6 · pos_cash_shifts=189 · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries | Verdict |
|------|-----:|--------:|---------|
| `GET /admin/reports/profit-loss?year=2026&branch=…` | **~20 ms** | **7** | **OK** — year aggregates |
| `GET …/cash-shifts/summary?store_location_id=…` | **~17 ms** | **9** | **OK** |
| `GET …/cash-shifts` today (≈0–2 rows) | **~13 ms** | **5** | OK when empty |
| `GET …/cash-shifts` **90-day** (page 20 / total 186) | **~780–793 ms** | **226** | **Hotspot** |

**Main finding:** Profit & Loss is a small set of yearly GROUP BY queries and is healthy. Cash Shift **report** is slow because `cashSalesForShift()` runs **two live order scans per shift**, and `buildPeriodSummary()` does that for **every CLOSE row in the filter** (not just the page), then the page transform does it again for listed rows → **~204 `order_payments` queries** locally on a 90-day load.

---

## Page → API map

### `/reports/profit-loss`
| UI | API | Backend |
|----|-----|---------|
| Year + branch header | `GET /admin/reports/profit-loss?year=&branch_store_location_id=` or `branch_scope=all` | `ProfitLossReportService::monthly` → sales summary + costing + expenses |

### `/reports/cash-shifts`
| UI | API | Notes |
|----|-----|--------|
| Pool cards | `GET /ecommerce/reports/cash-shifts/summary` | Pool balances (+ open shifts when all-branches) |
| Table / filters / page | `GET /ecommerce/reports/cash-shifts` | Paginate 20; embeds `period_summary` |
| Details drawer | Client-only from row | No extra fetch |

---

## Root causes & EXPLAIN

### 1. Cash shifts — per-shift cash sales N+1 (critical)

`PosCashShiftController::serializeShift` → `cashSalesForShift`:

```text
1) SUM(order_payments.amount) JOIN orders
     WHERE LOWER(payment_method)='cash'
       AND (paid_at BETWEEN open..close OR paid_at IS NULL AND created_at BETWEEN …)
       AND store_location_id = ?
2) SUM(orders.grand_total) fallback for cash orders with no payment rows
```

Called from:
1. **`buildPeriodSummary`** — `->get()` **all** CLOSE shifts matching filters, then serialize each  
2. **Page `transform`** — serialize each of the **20** page rows  

**90-day branch report (measured):**

| Metric | Value |
|--------|------:|
| Wall | **~780 ms** |
| Total queries | **226** |
| `order_payments` queries | **204** |
| Page rows | 20 |
| `total` (paginator) | 186 |
| Period CLOSE load | ~100+ |

Empty/today window: **~13 ms / 5 q** (no cash-sales loops).

**EXPLAIN** (one cash-sales payment SUM, sample window): Nested Loop · Index on `orders(store_location_id,…)` · ~**0.08 ms** per call — individually cheap, **catastrophic when ×200**.

**Root cause:** Live recomputation of cash sales per shift with no request-level batching / snapshot.

**Recommendation (safe, shape-preserving):**
- **P0:** Request-scoped memo keyed by `(open_shift_id|opened_at, closed_at, store_location_id)` so period summary + page share results.
- **P0:** Replace period summary’s per-row PHP loop with **one batched SQL** (or reuse memoized values) — same `cash_sales` / `difference` numbers.
- **P1:** On CLOSE, persist `cash_sales_snapshot` (additive column) and read it in report — biggest win; needs careful backfill / same formula.
- **P1:** Batch all open windows in the result set into a single ranged aggregate (harder; same totals).

Trade-offs: memo/batch = low risk; snapshot column = storage + write on close + migration.

---

### 2. Cash shifts — non-sargable `whereDate` + loose OR window (medium)

```php
whereDate('opened_at', '>=', $from)->orWhereDate('closed_at', '>=', $from);
whereDate('opened_at', '<=', $to)->orWhereDate('closed_at', '<=', $to);
```

**EXPLAIN:** Seq Scan · `date(opened_at)` / `date(closed_at)` filter · ~0.05 ms at 189 rows.

`DATE()` / `::date` blocks btree use on `opened_at`/`closed_at`. OR semantics also pull many historical opens that closed inside the range.

**Indexes today:**

| Index | Columns |
|-------|---------|
| `cash_shift_branch_event_idx` | `(store_location_id, event_type, opened_at)` |
| `pos_cash_shifts_opened_at_closed_at_index` | `(opened_at, closed_at)` |
| `pos_cash_shifts_status_opened_by_index` | `(status, opened_by)` |

**Recommendation:** Sargable bounds  
`opened_at >= startOfDay(from) OR closed_at >= …` (and `< nextDay(to)`) — same calendar-day intent; enables index use as volume grows.

---

### 3. Cash shifts — `ORDER BY COALESCE(closed_at, opened_at)` (low today)

**EXPLAIN:** Sort top-N after Seq Scan · **0.18 ms** at 186 rows. Expression sort cannot use plain `(opened_at, closed_at)` index directly.

**Optional:** generated column / expression index on `COALESCE(closed_at, opened_at)` — only if sort cost shows in prod EXPLAIN.

---

### 4. Cash shifts — summary path (OK)

Single-branch summary: pool balances + open shift · **~17 ms / 9 q**. Fine. All-branches loads pool accounts + open shifts + unassigned count — still light vs report.

Duplicate `accessibleStoreLocations` / authorize on report (~2–4 store_location queries) — micro; optional request memo already used elsewhere.

---

### 5. Profit & Loss — yearly aggregates (healthy)

`ProfitLossReportService::monthly`:
1. `salesSummary` → ecommerce / booking / refund GROUP BY month (~3 SQL)
2. `ecommerceCostingByMonth` → SUM `cost_amount_snapshot` GROUP BY month
3. `expensesByMonth` → SUM amount GROUP BY month (branch-scoped)

**Measured:** **~20 ms / 7 queries** · payload ~2 KB.

**Query log (SQL ms):** ecommerce ~2.3 · booking ~6.0 · refund ~0.6 · costing ~1.6 · expense ~0.6.

**EXPLAIN expenses:** uses store_location index + date filter · **~0.1 ms**. Expense date indexes already present (`expenses_live_branch_date_id_idx`, etc.).

**Recommendation:** None required for P&L at current size. At much larger order volumes, revisit `COALESCE(placed_at, created_at)` bill-at expression / covering indexes shared with Yearly Sales — same service.

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk |
|----------|--------|---------|------|
| **P0** | Memo / batch `cashSalesForShift` for report + period summary | 226 q → ~tens; ~780 ms → much lower | Low if totals match |
| **P0** | Stop loading all CLOSE rows as models for period summary | Cuts eager loads + double serialization | Low |
| **P1** | Sargable date filters (no `whereDate`) | Index-friendly filters | Low (verify day bounds) |
| **P1** | Persist cash sales on CLOSE | O(1) report read | Medium (migration + backfill) |
| **P2** | Expression index on `COALESCE(closed_at, opened_at)` | Faster sort at scale | Small write cost |
| **—** | P&L query rewrite / new expense indexes | Not needed now | — |

---

## Bottom line

`/reports/profit-loss` is **not** a query hotspot (~20 ms, fixed yearly aggregates).  
`/reports/cash-shifts` **is**: period summary + row serialization recompute cash sales with **2 SQL calls per shift**, exploding to **~200+ queries / ~0.8 s** on a 90-day filter locally. Prefer **batching/memoization** first (behavior-identical), then optional **snapshot on close** and **sargable dates**.
