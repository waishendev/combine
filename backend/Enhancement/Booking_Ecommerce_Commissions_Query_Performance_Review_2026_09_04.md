# Booking + Ecommerce Staff Commissions — Query Performance Review (2026-09-04)

**Scope**
- CRM `/booking/commissions` — `StaffCommissionsTable type=BOOKING`
- CRM `/ecommerce/commissions` — `StaffCommissionsTable type=ECOMMERCE`

Both pages share one table component and the same list API:  
`GET /api/admin/booking/commissions?type=BOOKING|ECOMMERCE` (+ optional `year`, `month`, `staff_id`, `branch_store_location_id`, `page`, `per_page`).

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · `staff_monthly_sales`=32 (BOOKING=19, ECOMMERCE=13) · active staff=4 · store_locations=2 · median of 5 wall.

**Related:** Tier CUD / `recalculateAllMonthly` was covered in `Staff_Consumables_Commission_Tiers_Query_Performance_Review_2026_08_25.md`. This review focuses on **list page load**.

---

## Executive summary

| Call | Wall | Queries | Payload | Verdict |
|------|-----:|--------:|--------:|---------|
| `GET …/commissions?type=BOOKING&per_page=15` | **~21 ms** | 6 | ~11 KB | **OK** |
| `GET …/commissions?type=ECOMMERCE&per_page=15` | **~19 ms** | 6 | ~9 KB | **OK** |
| + `year`+`month` | **~11–13 ms** | 6 | smaller | **OK** |
| + `branch_store_location_id` | **~21 ms** | 6 | ~11 KB | **OK** |
| + `staff_id` | **~12 ms** | 6 | ~3 KB | **OK** |
| `per_page=200` | **~25 ms** | 6 | ~12 KB | OK locally; watch at scale |
| Staff dropdown `GET /staffs?per_page=200&is_active=true` | (prior review ~40 ms) | ~6–7 | — | Clamped to **50**; over-eager |

**Main finding:** List path is a **pre-aggregated monthly snapshot** (`staff_monthly_sales`) with eager `staff` + `storeLocation` — **no N+1**, no join to bookings/orders on page load. Indexes for type/period/branch already exist. At 32 rows the planner uses Seq Scan (expected); wall time is mostly PHP + branch-scope auth (~2 of 6 queries), not the monthly table scan (~0.05 ms SQL).

**No production-critical list-query change is required today.** Safe scale prep below.

---

## Page → API map

| UI | API | Notes |
|----|-----|--------|
| Table load / filter / page | `GET /admin/booking/commissions` | `type` required by FE; paginate; `orderByDesc year, month` |
| Staff filter dropdown | `GET /staffs?per_page=200&is_active=true` | Backend **hard-caps at 50**; eager admin + storeLocations |
| Freeze / reopen / override | PATCH per-row or month | Writes + logs |
| Recalculate | `POST …/commissions/recalculate` | Heavy write path (rebuild from bookings/orders) — not list |

Controller list (shape):

```php
StaffMonthlySale::query()
  ->with(['staff:id,name', 'storeLocation:id,code,name'])
  ->where('type', $type);
$scope->apply($query); // store_location_id IN (…) [OR IS NULL]
// optional year / month / staff_id
->orderByDesc('year')->orderByDesc('month')->paginate($per_page);
```

---

## Root causes & EXPLAIN

### 1. List core — healthy snapshot query

**Query log (BOOKING default, authenticated):**

```text
#01 roles EXISTS (platform bypass check)           ~0.7 ms
#02 accessible store_locations (whereHas users)    ~0.5 ms
#03 COUNT(*) staff_monthly_sales + branch scope    ~0.4 ms
#04 SELECT … ORDER BY year DESC, month DESC LIMIT  ~0.5 ms
#05 staffs WHERE id IN (…)                         ~0.3 ms  ← eager
#06 store_locations WHERE id IN (…)                ~0.4 ms  ← eager
```

Eloquent-only mirror (no branch scope): **~5.8 ms / 4 queries**.

**EXPLAIN ANALYZE** (`WHERE type='BOOKING' ORDER BY year DESC, month DESC LIMIT 15`):

```text
Limit → Sort → Seq Scan on staff_monthly_sales
Filter: type = 'BOOKING'  (19 rows)
Sort Method: quicksort Memory: 29kB
Execution Time: ~0.05 ms · Buffers: shared hit=2
```

Same pattern for ECOMMERCE (~0.03 ms). Indexes present but unused at this cardinality (correct planner choice).

**Indexes today:**

| Index | Columns |
|-------|---------|
| UNIQUE `staff_monthly_sales_branch_identity` | `(store_location_id, type, staff_id, year, month)` |
| `staff_monthly_sales_branch_period` | `(store_location_id, type, year, month)` |
| `staff_monthly_sales_type_year_month_index` | `(type, year, month)` |
| `…_type_year_month_status_index` | `(type, year, month, status)` |
| `staff_monthly_sales_status_index` | `(status)` |

---

### 2. Branch scope `IN (…) OR IS NULL` (low today / medium later)

`ExpenseBranchScope::apply` adds:

```sql
(store_location_id IN (…) OR store_location_id IS NULL)
```

**EXPLAIN** (scoped BOOKING): still Seq Scan at n=32 · **~0.03 ms**.

At large volume, `OR … IS NULL` can discourage a clean Index Scan on `staff_monthly_sales_branch_period`. Single-branch header filter (`branch_store_location_id`) uses equality only (`includeUnassigned=false`) and matches the branch_period index well.

**Recommendation (safe, optional):** Prefer header branch filter in CRM for large tenants; or later rewrite unassigned as `UNION ALL` of indexed branch rows + null rows (same semantics, better plans). Trade-off: slightly more SQL complexity; no API change.

---

### 3. Sort / filter indexes — present; optional covering tweak (P2)

Default list filters `type` and sorts `year DESC, month DESC`. Existing `(type, year, month)` supports filter; sort may still need a top-N sort until rows are large.

**Optional additive index (only if prod EXPLAIN shows Sort spilling / high cost):**

```sql
CREATE INDEX CONCURRENTLY staff_monthly_sales_type_period_desc
  ON staff_monthly_sales (type, year DESC, month DESC);
```

Trade-off: extra storage + write cost on recalculate/upsert. **Not needed** at tens/hundreds of rows.

Staff filter uses `type` + `staff_id`; unique identity leads with `store_location_id`, so staff-only lists may Seq Scan longer. Optional `(type, staff_id, year, month)` if staff history grows — low priority.

---

### 4. Staff dropdown over-fetch (P2 — page-adjacent)

FE requests `per_page=200` but `StaffController@index` clamps to **50** and eager-loads admin + storeLocations. Same finding as prior staffs/consumables review.

**Recommendation:** Slim `id,name` list for filter dropdowns (additive endpoint or query flag). Does not change commission list contract.

---

### 5. Recalculate / freeze-month (write path — not list)

Month recalculate rebuilds from bookings/order splits and can be slow; prior review already recommends batching tier resolution inside `recalculateMonthly`. Freeze/reopen month loops rows + logs — O(staff×branches) updates, acceptable if rare.

List pages do **not** recalculate on load.

---

### 6. Missing indexes? — No blockers for list

| Concern | Status |
|---------|--------|
| N+1 on list | Mitigated (`with staff`, `storeLocation`) |
| Joins to bookings/orders on list | None |
| Type + period index | Present |
| Branch + period index | Present |
| Unique identity | Present |

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk |
|----------|--------|---------|------|
| **—** | New list indexes now | None at current size | Extra write cost |
| **P2** | Slim staff dropdown for filter | Less payload/CPU on page open | Low (additive) |
| **P2** | `(type, year DESC, month DESC)` if prod Sort cost grows | Faster default list at large history | Small write overhead |
| **P2** | Avoid `OR IS NULL` via UNION or encourage branch filter | Better use of `branch_period` | Careful semantic parity |
| **P1 (writes)** | Batch tiers in recalculate (prior review) | Faster month actions | Low if logic unchanged |
| **Ops** | Re-run EXPLAIN on prod when monthly rows ≫10k | Confirm index use | — |

---

## Bottom line

`/booking/commissions` and `/ecommerce/commissions` share a **lightweight paginated read** of `staff_monthly_sales`. Local wall ~**11–25 ms / 6 queries**; SQL on the monthly table is **≪1 ms**. Indexes for the hot predicates already exist. The only page-adjacent waste is the **heavy staffs dropdown**. Treat recalculate as a separate write-performance topic (already documented). **No must-ship list SQL change** for production stability.
