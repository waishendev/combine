# Booking Logs + Staff Consumables — Query Performance Review (2026-08-25)

**Scope:** CRM `/booking/logs`, `/logs/staff-consumables`  
**Constraint:** Analysis only — no business logic / API / response / UX changes.  
**Environment:** Local Postgres · superadmin · dataset below.

## Dataset (local)

| Table / filter | Count |
|----------------|------:|
| `booking_logs` | 547 |
| `users` | 10 |
| `order_items` | 1,483 |
| `order_items.is_staff_free_applied = true` | 1 |
| `orders` | 596 |
| `staffs` active | 7 |

---

## 1. `/booking/logs`

### Page → APIs

| Action | API |
|--------|-----|
| List / filter / page | `GET /api/admin/booking/logs?page&per_page&action?` |
| Export CSV | `GET /api/admin/booking/logs/export.csv` (same params; **current page only**) |
| Details drawer | No fetch (uses row `meta`) |

Controller: `Admin\Booking\LogController`  
CRM filter UI only sends exact `action` (backend also supports `from`/`to`/`actor_*`/`booking_id` unused by CRM).

### Query shape

```text
BookingLog::query()
  + optional equality / date filters
  -> orderByDesc(created_at)
  -> paginate(per_page)          -- COUNT(*) + SELECT *
  -> transform: User::find(actor_id) per STAFF/ADMIN row
```

### Benchmark (median of 5)

| Call | Wall | SQL | Queries | Payload |
|------|-----:|----:|--------:|--------:|
| List `per_page=50` | **119 ms** | 41 ms | **42** | 19.5 KB |
| List `per_page=200` | **520 ms** | 182 ms | **176** | 68.9 KB |
| List + `action=` | 25 ms | 3 ms | 2 | 10.7 KB |
| Export (page) | 147 ms | 45 ms | 42 | stream |

**N+1 evidence (one run, page 50):** `total_queries=42`, ~40 hits on `users` (`User::find` per row).

### EXPLAIN ANALYZE

**Default list** (`ORDER BY created_at DESC LIMIT 50`):

- **Seq Scan** on `booking_logs` (547 rows) → top-N heapsort
- No index on `created_at`
- Execution ~0.29 ms locally (tiny table); will degrade as logs grow

**COUNT(*)** for paginator: Seq Scan entire table.

**Action filter:** Seq Scan + filter on `action` (no `action` index) + sort.

### Indexes present

| Index | Present? |
|-------|----------|
| PK `id` | Yes |
| FK `booking_id` | **Missing in live DB** (only `booking_logs_pkey` found) |
| `created_at` | **No** |
| `action` | **No** |
| `(action, created_at)` | **No** |

### Findings — booking logs

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P0** | Classic **N+1** actor names | `User::find` inside `transform` per row | Batch: collect distinct `actor_id` → one `User::whereIn` → map names (same `actor_name` field) | None on API shape; large win at `per_page=200` |
| **P0** | Missing list indexes | Default path sorts/filters without btree | `CREATE INDEX … ON booking_logs (created_at DESC)` or `(created_at DESC, id DESC)`; optional `(action, created_at DESC)` for CRM filter | Small write cost on append-only log inserts |
| P1 | Full row + JSON `meta` on every list row | `SELECT *`; drawer needs meta but list does not | Slim list columns + lazy meta fetch **would** change flow — defer unless product wants new endpoint | Behavior/UX change if split |
| P1 | Export reuses paginated `index` | Only exports current page; still pays N+1 | Chunked unpaginated export (same CSV columns) | Export semantics change if currently “page only” is unintentional |
| P2 | Laravel `COUNT(*)` on growing log | Full scan without covering index | `created_at` index helps; or `simplePaginate` if UX OK | Cursor/simple paginate changes meta |
| P2 | Mixed STAFF `actor_id` (user vs staff id) | Some writers store `staffs.id` | Document; resolve STAFF via `staffs` when needed | Correctness + fewer wasted user finds |

---

## 2. `/logs/staff-consumables`

### Page → APIs

| Action | API |
|--------|-----|
| Staff dropdown (once) | `GET /api/staffs/options/query?per_page=500` *(already slim)* |
| Logs / filters / page | `GET /api/admin/staff-consumables/logs?page&per_page&from_date&to_date&staff_id&search` |

### Already applied (`staff-consumables-commission-query-v1`)

- Partial indexes: `order_items … WHERE is_staff_free_applied`, `orders … WHERE payment_method = 'staff_free'`
- Claim + date filters merged into **one** `whereHas(order)`; sargable `created_at` ranges
- Slim staff options endpoint

### Benchmark (median of 5 · current code)

| Call | Wall | SQL | Q | Payload |
|------|-----:|----:|--:|--------:|
| Base page | 29 ms | 9 ms | 7 | 0.5 KB |
| + 90d dates | 32 ms | 10 ms | 7 | 0.5 KB |
| + search | 47 ms | 15 ms | 7 | 0.5 KB |
| Staff options | 16 ms | 5 ms | 4 | 0.9 KB |

### EXPLAIN ANALYZE (base — current)

```text
Index Scan order_items_staff_free_applied_id_idx
  → Index Scan orders_pkey + claim filter
Execution ~0.07 ms · buffers=5
```

Plan is healthy after prior enhancement (no longer seq-scans all orders).

### Remaining findings — consumables

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P1** | Search still expensive | Many `%LIKE%` on snapshots **plus** product/variant/order/staff/creator `whereHas` | Prefer snapshot + `order_number` first; keep relation OR only if product requires | May slightly change match set if names only live on relations |
| P2 | Eager loads full related models | `order.creator.staff`, product, variant for serialize | Already column-limited; optional further slim | Low |
| P2 | `notes LIKE '%claim%'` fallback | Leading wildcard | Prefer equality on `payment_method` when all claim orders set it | Confirm data completeness before dropping notes OR |
| OK | List N+1 | Eager-loaded | — | — |
| OK | Base filter indexes | Partial indexes live | — | — |
| OK | Staff dropdown | Slim `/staffs/options/query` | — | — |

---

## Cross-page priority board

1. **Booking logs N+1** — batch `User::whereIn` (highest ROI; 42→~3 queries at page 50; 176→~3 at page 200).
2. **Booking logs indexes** — `(created_at DESC)` + `(action, created_at DESC)` for production growth.
3. **Consumables search** — narrow LIKE/`whereHas` tree (optional, measure in prod with real claim volume).
4. Booking export completeness / slim list meta — product decision (may change behavior).

## What not to change casually

- Response JSON keys (`actor_name`, paginator shape, consumable serialize fields)
- Consumables claim detection (`notes` OR `payment_method`) until data audit
- Booking export “current page only” without confirming product intent
