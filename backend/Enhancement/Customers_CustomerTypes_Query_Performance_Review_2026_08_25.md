# CRM Customers + Customer Types — Query Performance Review (2026-08-25)

**Scope**
- `/customers` (list + Create / Edit / Delete / View / deposit waiver / adjust points / assign voucher / manage balance)
- Nested: `/customers/[id]/history`, link to `/customers/points-adjustment-logs` (and deposit-waiver logs if linked)
- `/customer-types` (list + Create / Edit / Delete modals)

**Constraint:** Analysis only — no business logic / API / UX changes.  
**Environment:** Local Postgres · ~655 customers · 4 types · 605 points batches · 596 orders · superadmin controller bench · median of 5 (wall). Query counts below from a **single** instrumented list call (listener stacking inflated multi-run q counts).

---

## Executive summary

| Call | Wall | SQL-ish | Payload | Queries |
|------|-----:|--------:|--------:|--------:|
| `GET /customers?per_page=50` | **~257 ms** | high | 30 KB | **~103** (= 1 page + 2×N loyalty) |
| `GET /customers?per_page=15` | **~85 ms** | | 10 KB | **~34** |
| `GET /customers/{id}` show | ~16 ms | | 0.8 KB | ~21 |
| `GET /customers/{id}/history` API | ~23 ms | | 0.4 KB | ~39 |
| `GET /customer-types` (15 / 200) | **~5 ms** | | ~1 KB | 6 |

**Customer Types page is already fast** (tiny table, unique name index).  
**Customers list is the hotspot:** classic **2×N aggregate N+1** after pagination (`points_earn_batches` sum + `orders` spent-in-window sum per row). At 655 rows this is noticeable; it will scale linearly with page size and worse with data growth because `points_earn_batches` currently **seq-scans** (no `customer_id` index).

---

## Page → API map

### `/customers`
| UI action | API | Notes |
|-----------|-----|--------|
| List / filter / page | `GET /customers` | `formatCustomerWithSummary` per row |
| Create modal open | `GET /customer-types?per_page=200` | Fine (~5 ms) |
| Create submit | `POST /customers` | Single insert |
| Edit modal open | `GET /customer-types?per_page=200` + row data from list (PUT uses id) | Edit PUT → `formatCustomerWithSummary` again |
| View panel | `GET /customers/{id}` | `formatCustomerWithDetails` (extra loyalty totals + waiver log) |
| Delete | `DELETE /customers/{id}` | Simple |
| Deposit waiver | `PATCH .../deposit-waiver` | Then returns **full details** payload |
| Adjust points | `PATCH .../points-adjustment` | Write path |
| Assign voucher | ecommerce vouchers assignable + assign | Separate ecommerce APIs |
| Manage balance | admin wallet adjustments | Separate |
| History link | `/customers/{id}/history` page | See below — **does not call** `GET /customers/{id}/history` |

### `/customers/[id]/history` (from row action)
Parallel first paint:
1. `GET /ecommerce/reports/sales/ecommerce?customer_id&per_page=200&date_from=2000-01-01…`
2. `GET /ecommerce/reports/sales/booking?…` (same)
3. `GET /customers/{id}`
4. `GET /admin/customers/{id}/wallet`
5. `GET /admin/customers/{id}/wallet/transactions?per_page=100`

Backend already has a lighter `CustomerController@history` (~23 ms) that the CRM page **does not use**.

### `/customer-types`
| UI action | API |
|-----------|-----|
| List | `GET /customer-types` |
| Create / Edit / Delete | `POST` / `GET+PUT` / `DELETE` |

All cheap at current cardinality (4 rows).

---

## Root causes (Customers list)

### 1. N+1 loyalty enrichment (primary)

```php
// CustomerController@index → through(formatCustomerWithSummary)
getAvailablePoints($customer);   // SUM points_earn_batches WHERE customer_id = ?
getSpentInWindow($customer, …);  // SUM orders WHERE customer_id = ? AND status IN (…) AND created_at BETWEEN …
```

For `per_page=15` → **~30 aggregate queries** + 1 list + loyalty setting + tier rules.  
For `per_page=50` → **~100 aggregates**.

Response fields used by CRM list: `available_points`, `spent_in_window`, `next_tier`, `amount_to_next_tier`, `wallet_balance` (column — no extra query).

### 2. Missing index on `points_earn_batches.customer_id`

**EXPLAIN ANALYZE** (one-customer points sum):

```
Seq Scan on points_earn_batches
  Filter: (points_remaining > 0) AND (customer_id = ?) AND (expires_at > now())
  Rows Removed by Filter: 605
Execution Time: ~0.14 ms
```

At 605 rows, each sum is cheap; **at tens/hundreds of thousands of batches, list wall will explode** (50 × seq scan).  
Current indexes on table: **PK only**.

Orders spent-in-window already uses `orders_customer_id_created_at_index` (Index Scan ~0.05 ms) — OK.

### 3. `customers` list sort: seq scan + sort

**EXPLAIN ANALYZE** `ORDER BY created_at DESC LIMIT 50`:

```
Sort Method: top-N heapsort
  -> Seq Scan on customers (655 rows)
Execution Time: ~0.41 ms
```

Indexes today: PK, unique `email`, unique `phone` — **no `(created_at)`**, **no `(customer_type_id)`**, **no `(tier)` / `(is_active)`**.

Fine at 655; will degrade as customers grow (especially filtered pages still sorting).

### 4. Leading-wildcard filters

`name/email/phone LIKE '%…%'` → Seq Scan (expected).  
`search` also `orWhereHas('customerType', name LIKE …)` — extra join/subquery when used.

### 5. History UI over-fetch (related action)

CRM history page fires **two sales report APIs at `per_page=200` from year 2000** plus show + wallet + 100 txs — much heavier than dedicated `@history` (limit 10 per section). Safe future win: wire FE to existing history endpoint **or** constrain report date/page defaults without changing report contracts for other pages.

---

## Customer Types

- `orderBy('name')` on 4 rows: Sort over Seq Scan, **0.07 ms**.
- Unique `name` already present.
- Create/Edit uniqueness checks use that unique index.
- **No material list bottleneck.** Optional later: options endpoint if types grow large; not needed now.

---

## Recommended safe optimizations (do not apply in this review)

Priority = impact × low risk of behavior change.

| # | Change | Why | Trade-off | Behavior risk |
|---|--------|-----|-----------|---------------|
| **P0** | After paginate, **batch** `available_points` + `spent_in_window` with `WHERE customer_id IN (…)` (2 queries total), map in PHP | Cuts list from O(2N) → O(1) aggregates | Slightly more complex controller | **Low** if same formulas / same JSON keys |
| **P0** | Index `points_earn_batches (customer_id, expires_at)` or partial `(customer_id) WHERE points_remaining > 0` | Stops seq scan on every points sum (list + show + adjust flows) | +storage; slightly slower batch inserts | **None** (read path) |
| **P1** | Index `customers (created_at DESC)` | Faster default list sort at scale | +storage; slower inserts | **None** |
| **P1** | Index `customers (customer_type_id)` | Helps type filters / joins / search `whereHas` | +storage | **None** |
| **P2** | Index `customers (is_active, created_at DESC)` and/or `(tier, created_at DESC)` | Faster filtered lists | More indexes | **None** |
| **P2** | Optional `pg_trgm` GIN on `name` / `email` / `phone` | Speeds `%like%` filters | Extension + write cost; overkill until table is large | **None** if queries unchanged |
| **P2** | History page: prefer `GET /customers/{id}/history` or narrower report range | Less report fan-out | FE change; keep old APIs | **Medium** — must match UI fields |
| **P3** | Show/details: batch or reuse window sums; deposit-waiver response could return list-shaped summary instead of full details | Fewer queries on toggle | Response shape must stay identical for FE | **Higher** if FE expects details keys |

**Avoid for “safe / no behavior change” without product sign-off:** denormalizing `available_points` onto `customers` (stale risk), changing loyalty formulas, dropping list loyalty fields.

---

## EXPLAIN highlights (local)

| Query | Plan | Time |
|-------|------|-----:|
| List `ORDER BY created_at DESC LIMIT 50` | Seq Scan + top-N Sort | 0.41 ms |
| `name ILIKE '%a%'` | Seq Scan + Sort | 0.87 ms |
| Points sum by `customer_id` | **Seq Scan** on batches | 0.14 ms |
| Orders spent in window | **Index Scan** `orders_customer_id_created_at_index` | 0.05 ms |
| Customer types `ORDER BY name` | Seq Scan + Sort (4 rows) | 0.07 ms |

SQL itself for one row is fast; **list cost = round-trips × page size**, and missing `points_earn_batches` index is the ticking bomb.

---

## Suggested apply order (when approved)

1. Migration: `points_earn_batches(customer_id, …)` + `customers(created_at DESC)` + `customers(customer_type_id)`.
2. Refactor list enrichment to batched aggregates (same response).
3. Re-bench `/customers?per_page=50` (expect wall ≪ 257 ms and queries ≈ 5–10).
4. Separately: history FE wiring review.

---

## Out of scope / already OK

- Customer type CRUD latency.
- Unique email/phone on customers (good for lookups; not for list sort).
- Orders/bookings indexes for per-customer history API paths (already present).
