# Booking Logs Query Enhancement (2026-08-25)

Enhancement id: `booking-logs-query-v1`  
Also covers remaining notes for CRM `/logs/staff-consumables` (already on `staff-consumables-commission-query-v1`).

## What landed

### Booking logs (`LogController`)
- **Kill N+1:** one `User::whereIn` for distinct STAFF/ADMIN `actor_id`s (same `actor_name` semantics)
- **Indexes** (`2026_08_25_000300_…`):
  - `(created_at DESC, id DESC)`
  - `(action, created_at DESC, id DESC)`
  - `(booking_id, created_at DESC) WHERE booking_id IS NOT NULL`
- **Export:** streams **all** filtered rows via cursor (same CSV columns); no longer limited to current page / no per-row user lookups
- Stable JSON list shape unchanged (`actor_name` still present; full `meta` kept for drawer)

### Staff consumables
- Search OR order lightly reordered (snapshots / `order_number` first); **same match branches** kept
- Base path already indexed from prior enhancement

## Benchmark (local · median of 5 · 547 booking_logs)

| Path | Before | After | Delta |
|------|--------|-------|-------|
| List `per_page=50` wall | 119 ms | **38 ms** | **−68%** |
| List `per_page=50` queries | 42 | **3** | **−93%** |
| List `per_page=50` SQL | 41 ms | **3.2 ms** | **−92%** |
| List `per_page=200` wall | 520 ms | **90 ms** | **−83%** |
| List `per_page=200` queries | 176 | **3** | **−98%** |
| EXPLAIN list exec | 0.29 ms · Seq Scan | **0.07 ms · Index Scan** | **−76%** |
| Export | 1 page + 42 q | **full set · 1 q · stream** | Correct + cheaper per row |

Consumables base/search remain ~flat locally (already on partial indexes; search still LIKE-heavy by design).
