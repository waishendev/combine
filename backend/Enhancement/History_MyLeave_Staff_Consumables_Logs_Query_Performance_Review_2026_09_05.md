# History + My Leave + Staff Consumable Logs — Query Performance Review (2026-09-05)

**Scope**

| Page | Client | Primary APIs |
|------|--------|--------------|
| `/staff-consumables/history` | `StaffConsumableHistoryPageContent` | `GET /admin/staff-consumables/my-history` |
| `/booking/my-leave` | `BookingMyLeavePage` | `GET …/balances`, `…/eligible-branches`, `…/requests` (+ POST/PATCH mutations) |
| `/logs/staff-consumables` | `StaffConsumableLogsPageContent` | `GET /staffs/options/query` + `GET /admin/staff-consumables/logs` |

**Constraint:** Analysis only — no business logic / API / UX changes in this pass.

**Environment:** Local Postgres · order_items=2,284 (staff_free_applied=37) · orders=1,037 (staff_free=17) · leave_requests for staff#1=55 · median of 5.

**Prior work:** Logs/history share `staff-consumables-commission-query-v1` (partial indexes, slim staff options, sargable log dates). My-leave shares leave-pages-v1 usage index `(staff_id, status, leave_type) INCLUDE (days)`.

---

## ACTION / navigation analysis

**None of these three pages navigate to another CRM route from Action columns.**

| Page | Control | Behavior | Other page APIs? |
|------|---------|----------|------------------|
| History | *(none)* | Read-only table | No |
| My Leave | Cancel / View / Cancel change / Request day change / Apply Leave | On-page modals → POST/PATCH my-leave APIs, then reload balances+requests | **No** route change |
| Staff consumable logs | Filter / Reset / Clear staff / pager only | No Action column | **No** |

**Inbound only (not an Action on these pages):** Staffs row Action → `/logs/staff-consumables?staff_id={id}` (`StaffRow.tsx`). That only seeds filters on this logs page (same two APIs). No need to re-review `/staffs` for click-through from these three pages.

---

## Executive summary

| Call | Wall | Queries | Verdict |
|------|------|---------|---------|
| My-history `limit=50` | **~28 ms** | 10 | OK; claim EXISTS + creator OR; no N+1 |
| Logs page 1 | **~66 ms** | 13 | Partial indexes help; **4 filter passes** (2×SUM + COUNT + SELECT) |
| Logs + search=`a` | **~79 ms** | 13 | Still heaviest path (`%LIKE%` + relation ORs) |
| Logs staff dropdown | **~9 ms** | 4 | Already slim (`/staffs/options/query`) |
| My-leave balances | **~2.5 ms** | 2 | Healthy (leave-pages index) |
| My-leave eligible-branches | **~6–7 ms** | 3 | OK |
| My-leave requests upcoming | **~20 ms** | 6 | OK; `end_date::date` cast in SQL |
| My-leave requests all/past | **~42–46 ms** | 6 | Same shape; FE caps at 100, no pager |

---

## 1) `/staff-consumables/history`

### Query shape
```php
staffConsumableClaimQuery() // is_staff_free_applied + whereHas(order: notes LIKE OR payment_method=staff_free)
  -> where(staff_id OR whereHas order.creator.staff_id)
  -> whereHas(order: branch scope)
  -> latest(id)->limit(50)->get()
  -> with([order.creator.staff, order.storeLocation, staff, product, productVariant])
```

### Indexes today (v1)
- Partial `order_items (id DESC) WHERE is_staff_free_applied`
- Partial `order_items (order_id, id DESC) WHERE is_staff_free_applied`
- Partial `orders (id, created_at) WHERE payment_method = 'staff_free'`
- Partial `order_items (staff_id) WHERE staff_id IS NOT NULL`
- Partial `users (staff_id) WHERE staff_id IS NOT NULL`

### EXPLAIN
Claim path drives from **Seq Scan on orders** filtered by `notes ~~ '%staff_free…%' OR payment_method = staff_free` (~17 rows), then Index Scan on `order_items_staff_free_applied_order_id_idx`. Execution ~0.8 ms locally.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P2** | Fold branch `whereHas(order)` into the claim `whereHas(order)` (single EXISTS) | Avoids second correlated EXISTS | Safe refactor; same filters |
| **P2** | Prefer `payment_method = 'staff_free'` only **if** backfill guarantees all claims set it (drop leading `%LIKE%`) | Enables partial index; removes Seq Scan risk as orders grow | **Data correctness** — only after audit |
| Low | Eager already batched | No N+1 | — |
| Low | Keep `limit 50` / `get()` | Personal history by design | Not a CRM-wide list |

---

## 2) `/booking/my-leave`

### Query shapes
- **Balances:** entitlements `where staff_id` + usage `SUM(days) GROUP BY leave_type` (approved annual/mc/emergency) — **Index Only Scan** on leave-pages index.
- **Eligible branches:** accessible ∩ staff assignment → `store_locations whereIn`.
- **Requests:** `staff_id` + `(request_kind=new OR NULL)` + branch scope + optional status/type + **`whereDate('end_date', …)`** for upcoming/past → `orderByDesc(created_at)` → `paginate(100)`.
- Eager: `pendingDateChangeRequest`, `storeLocation` — **no N+1**.

### ACTION (mutations)
Cancel / date-change / apply stay on-page. Overlap checks in service still use `whereDate` + PHP day loops — fine for single-staff writes; not list hotspots.

### EXPLAIN / SQL notes
Laravel emits `"end_date"::date >= ?`. On a **date** column this is nearly equivalent to `end_date >= $today`, and plans match (~0.05–0.07 ms). Still prefer bare column compare for clarity and future-proofing if type changes.

List uses `(staff_id, status)` bitmap then Sort by `created_at` — **no** `(staff_id, created_at DESC)`.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Index `(staff_id, created_at DESC)` on `booking_leave_requests` | Matches my-leave list sort/paginate | Small write cost |
| **P1** | Replace `whereDate('end_date', …)` with `where('end_date', '>='| '<', $today)` | Same semantics for `date` columns; cleaner plans | Tiny, safe |
| **P2** | FE pagination or “load more” when `last_page > 1` | Today FE always `per_page=100` and ignores further pages → silent truncation on `all`/`past` | UX additive; API already paginates |
| Low | Balances already healthy | leave-pages INCLUDE index | — |

---

## 3) `/logs/staff-consumables`

### Query shape
```text
staffConsumableClaimQuery(from, to)   // one whereHas: claim + sargable created_at
  + whereHas(order) accessible branches
  + optional 2nd whereHas(order) for selected store_location_id   // double EXISTS
  + staff_id OR creator.staff_id
  + search: snapshot LIKEs + whereHas order/staff/product/variant/creator
→ clone SUM(quantity)
→ clone SUM(COALESCE line_total / unit*qty)
→ paginate (COUNT + SELECT)
```

Staff dropdown already uses slim `/staffs/options/query` (~9 ms).

### EXPLAIN
Base list: Seq Scan filtered staff_free orders → Index Only Scan claim items (~0.8 ms). Search still expands to many `%LIKE%` / `whereHas` OR branches (prior doc **P1**).

### Sample query count (page 1)
13 queries: auth + accessible stores + **qty SUM** + **price SUM** + **COUNT** + page SELECT + 7 eager batches. Eager is correct (no N+1); cost is **repeated claim filter evaluation**.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Merge accessible + selected branch into **one** `whereHas('order', …)` | Drops duplicate EXISTS when branch selected | Safe, same visibility |
| **P1** | Single SQL for summary: `SELECT SUM(qty), SUM(price), COUNT(*)` (or one aggregate query) instead of 2×SUM + COUNT clones | Same totals; fewer passes | Slightly denser SQL; response unchanged |
| **P1** | Search: prefer snapshot + `order_number` first; defer relation `whereHas` only if needed **or** require min length | Cuts worst-case OR tree | Must preserve match semantics if product relies on relation names |
| **P2** | Claim `notes LIKE` → payment_method-only after backfill | Same as history | Data gate |
| Low | Staff options already optimized | — | — |

---

## Safe optimization priority (when implementing)

1. My-leave: `(staff_id, created_at DESC)` + sargable `end_date` compare.
2. Logs: fold double `whereHas(order)`; combine summary aggregates into one query.
3. Logs/history: claim notes-LIKE cleanup only after data audit.
4. My-leave FE: optional pager if totals exceed 100 (API already ready).

---

## Already healthy

- No list N+1 on any of the three pages (eager / whereIn).
- Logs staff dropdown already slim.
- My-leave balances usage uses leave-pages Index Only Scan.
- Staff-consumable partial indexes from Aug 2025 still serve claim item lookups.
- ACTION mutations do not navigate off-page; no secondary page review required for click-through.
