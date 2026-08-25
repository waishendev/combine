# Staffs / Staff Consumables / Commission Tiers — Query Performance Review (2026-08-25)

**Scope:** CRM `/staffs` (all actions), `/logs/staff-consumables`, `/ecommerce/commission-tiers`  
**Constraint:** Analysis only — no business logic / API / response / UX changes.  
**Environment:** Local Postgres · superadmin · small dataset (see below). Wall times are therefore **PHP-overhead–dominated**; prioritize EXPLAIN shape + index gaps for production scale.

## Dataset (local)

| Table / filter | Count |
|----------------|------:|
| `staffs` / active | 8 / 7 |
| `staff_store_location` | 11 |
| `orders` | 596 |
| `order_items` | 1,483 |
| `order_items.is_staff_free_applied = true` | **1 (0.07%)** |
| `orders.payment_method = 'staff_free'` | 1 |
| `staff_commission_tiers` (ECOMMERCE) | 3 |
| `staff_monthly_sales` (ECOMMERCE) | 9 |

---

## 1. `/staffs` — page → APIs

| Action | API | Notes |
|--------|-----|-------|
| List / filter / page / branch | `GET /api/staffs` | Eager `admin` + `storeLocations`; `whereHas` branch; default `is_active=true`; search 6× `ILIKE '%…%'`; `orderBy name`; **`per_page` hard-capped at 50** |
| Create | `POST /api/staffs` | Tx + role ensure + branch sync |
| Edit open | `GET /api/staffs/{id}` | Eager admin + branches |
| Update | `PUT /api/staffs/{id}` | Tx + optional avatar/password/branches |
| Deactivate | `DELETE /api/staffs/{id}` | Soft deactivate staff + admin user |
| Export CSV | `GET /api/staffs/export` | Unbounded `get()` into memory |
| Import CSV | `POST /api/staffs/import` | Per-row find/validate/tx |
| View | (local) | No fetch |
| Consumable logs link | navigate | `/logs/staff-consumables?staff_id=` |

### Benchmark (median of 5)

| Call | Wall | SQL | Q | Payload |
|------|-----:|----:|--:|--------:|
| List (branch) | 44 ms | 8 ms | 7 | 4.8 KB |
| List (all branches) | 41 ms | 6 ms | 6 | 5.2 KB |
| List + search | 44 ms | 9 ms | 7 | 4.8 KB |
| Show | 13 ms | 4 ms | 4 | 0.8 KB |
| Export | 17 ms | 5 ms | 5 | stream |

### EXPLAIN — list by branch

- Pivot lookup uses `staff_store_location_store_location_id_staff_id_index` (good).
- `staffs` filtered with **Seq Scan** (`is_active`) — fine at n≈8; no `(is_active, name)` index.
- Sort by `name` in memory.

### Findings (priority)

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| P0 | Search cannot use B-tree | Leading-wildcard `ILIKE` on 6 columns | Keep as-is for correctness; optional **pg_trgm** GIN on `name`/`email`/`code` if search becomes hot | Extra storage + write cost on staff updates |
| P1 | Export unbounded memory | `->orderBy('id')->get()` full set | Stream cursor / chunked CSV (behavior-preserving) | Slightly more complex export code |
| P1 | Import N× queries/row | Per-row find + unique validators + tx | Batch validation / upsert later (careful) | Higher change risk — defer |
| P2 | UI `per_page` 100–200 ignored | Backend `min(50, …)` | Document only unless product wants larger pages | Raising cap changes payload size |
| P2 | No `(is_active, name)` index | List always filters active + sorts name | `CREATE INDEX … ON staffs (is_active, name)` | Small write cost; wins at thousands of staff |
| OK | Branch filter | Pivot index exists | No change | — |
| OK | List N+1 | Eager-loaded | No change | — |

---

## 2. `/logs/staff-consumables`

| Call | API |
|------|-----|
| Staff dropdown (once) | `GET /api/staffs?per_page=100` → **clamped to 50** + heavy eager loads |
| Logs list / filters | `GET /api/admin/staff-consumables/logs` |

### Query shape (`staffConsumableClaimQuery` + filters)

```text
order_items
  WHERE is_staff_free_applied = true
  AND EXISTS (
    orders: notes LIKE '%staff_free_consumable_claim%'
         OR payment_method = 'staff_free'
  )
  + optional date whereHas (whereDate) ×2
  + optional staff_id OR creator.staff_id
  + optional search: 5× LIKE on snapshots + many whereHas
ORDER BY order_items.id DESC
```

### Benchmark (median of 5)

| Call | Wall | SQL | Q | Payload |
|------|-----:|----:|--:|--------:|
| Base page | 21 ms | 8 ms | 7 | 0.5 KB |
| + 90d date range | 26 ms | 11 ms | 7 | 0.5 KB |
| + search | 33 ms | 13 ms | 7 | 0.5 KB |
| + staff_id | 25 ms | 10 ms | 7 | 0.5 KB |

### EXPLAIN ANALYZE — base filter (key finding)

Planner currently:

1. **Seq Scan `orders`** filtering `notes LIKE '%…%' OR payment_method = 'staff_free'` (595 rows removed)
2. Nested Loop → `order_items` via `order_items_order_id_is_package_index`, filter `is_staff_free_applied`

**Root cause:** No selective index on the rare `is_staff_free_applied = true` rows (0.07% locally). Leading-wildcard `notes` cannot use a normal B-tree. Planner prefers scanning orders then probing items.

Date filters add **two extra EXISTS** with `created_at::date` (non-sargable cast), increasing planning/join work.

### Findings (priority)

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P0** | Missing selective index on claim lines | Boolean column, no index | **Partial index:** `CREATE INDEX CONCURRENTLY … ON order_items (id DESC) WHERE is_staff_free_applied = true` (or `(order_id, id DESC) WHERE …`) | Tiny index (only true rows); negligible write cost on normal POS lines; claim writes touch the partial index |
| **P0** | `payment_method` equality unindexed | Seq scan driver today | `CREATE INDEX CONCURRENTLY … ON orders (payment_method) WHERE payment_method = 'staff_free'` **or** btree on `payment_method` | Small partial index ideal; full column index larger if many distinct methods |
| P1 | `notes LIKE '%claim%'` | Leading wildcard | Prefer equality path (`payment_method = 'staff_free'`) for filter if all claim orders set it; keep notes as fallback. Optional trigram only if notes search required | Partial migration of filter semantics needs product confirmation before changing SQL |
| P1 | Stacked `whereHas` + `whereDate` | Multiple EXISTS; date cast | Collapse to **one** join/subquery on `orders` with `created_at >= ? AND created_at < ?+1day` | Behavior-preserving if timestamps mapped carefully |
| P1 | Search explosion | Many `%LIKE%` + EXISTS | Restrict search to snapshots + `order_number` first; defer relation LIKEs | Slightly different match set if product names only on relation |
| P2 | Staff dropdown over-fetch | Full staff index + admin + locations; cap 50 | Dedicated slim `id,name` endpoint / higher limit for logs page | New endpoint = enhancement later |
| OK | Page N+1 | Eager `order.creator.staff`, `staff`, `product`, `variant` | No change for list path | — |

---

## 3. `/ecommerce/commission-tiers` (`type=ECOMMERCE`)

| Action | API | Hot path? |
|--------|-----|-----------|
| List | `GET /api/admin/booking/commission-tiers?type=ECOMMERCE&…` | Light |
| Create / Update / Delete | POST / PUT / DELETE | **Heavy** — always `recalculateAllMonthly` |

### List

- `with('storeLocation')` + `where type` + branch scope + `orderBy min_sales` + paginate
- Indexes present: `commission_tiers_branch_lookup`, unique `(store_location_id, type, min_sales)`
- EXPLAIN: trivial Seq Scan (3 rows); fine at current size

### Benchmark list (median of 5)

| Call | Wall | SQL | Q | Payload |
|------|-----:|----:|--:|--------:|
| Branch scoped | 16 ms | 5 ms | 5 | 3.1 KB |
| All branches | 16 ms | 5 ms | 5 | 3.1 KB |

### Write path — `recalculateAllMonthly`

```text
StaffMonthlySale where (type, store_location_id)
  chunkById(100)
    foreach row → StaffCommissionService::recalculateMonthly
      SELECT tier … ORDER BY min_sales DESC LIMIT 1
      SAVE monthly row (+ refresh)
```

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P0 (writes)** | N+1 tier lookup per monthly row | Tier query inside loop | Load all branch+type tiers **once**, resolve in PHP (same threshold rule) | Zero API contract change; large win when monthly history grows |
| P1 | Double `refresh()` after save | Extra SELECT per row | Return `$monthly` without second refresh if unused | Micro-optimization |
| OK | List indexes | Already branch+type+min_sales | No change | — |
| OK | List N+1 | Eager storeLocation | Optional slim `select id,name` later | — |

Local monthly rows = 9 → write cost is small here; production with years of staff×months will dominate CUD latency.

---

## Cross-page priority board

1. **Consumables:** partial index on `order_items (… ) WHERE is_staff_free_applied` + optional partial on `orders.payment_method = 'staff_free'` — lowest risk, highest scale payoff.
2. **Commission CUD:** batch tier resolution inside `recalculateAllMonthly` — no response shape change.
3. **Staffs:** `(is_active, name)` index when staff count grows; stream export; treat import as separate project.
4. **Consumables filters:** collapse order EXISTS + sargable date range (still same results).
5. **Dropdown:** slim staff list for logs page (enhancement API — out of “index-only” scope).

## What not to change casually

- Response JSON for any of these endpoints
- Default active-only staff list semantics
- Claim detection requiring both notes substring and `payment_method` until product confirms all rows set `payment_method = 'staff_free'`
- Commission recalculation **when** it runs (only **how** tiers are resolved) unless product accepts async jobs
