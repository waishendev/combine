# Staff / Consumables / Commission Tiers Query Enhancement (2026-08-25)

Enhancement id: `staff-consumables-commission-query-v1`

## What landed

### P0 indexes (migration `2026_08_25_000200_…`)
- `order_items (id DESC) WHERE is_staff_free_applied = true`
- `order_items (order_id, id DESC) WHERE is_staff_free_applied = true`
- `orders (id, created_at) WHERE payment_method = 'staff_free'`
- `staffs (is_active, name)`
- `staffs (email) WHERE email IS NOT NULL`
- `users (staff_id) WHERE staff_id IS NOT NULL`
- `order_items (staff_id) WHERE staff_id IS NOT NULL`

### Query / write path (same API contracts)
- Consumables logs: claim + date filters merged into **one** `whereHas(order)`; dates use sargable `created_at` ranges (not `whereDate`)
- Commission CUD: `recalculateAllMonthly` loads tiers **once**, resolves in memory; drops redundant `refresh()` after save
- Staff export: `chunkById(200)` instead of full `get()`
- New slim dropdown: `GET /api/staffs/options/query` (`id`,`name` only, `per_page` up to 500)
- CRM `/logs/staff-consumables` wired to options endpoint

## Benchmark (local · median of 5 · superadmin)

Dataset still tiny (8 staff, 1 staff-free line, 9 ecommerce monthly rows) — **SQL plan / query-count wins matter more than wall ms**.

| Path | Before | After | Delta |
|------|--------|-------|-------|
| Consumables SQL EXPLAIN (base) | 0.37 ms · Seq Scan orders (595 filtered) · 43 buffers | **0.06 ms · Index Scan partial** · **5 buffers** | **−83% exec · −88% buffers** |
| Consumables + date range (wall) | 26.4 ms | **21.7 ms** | **−18%** |
| Consumables + date SQL | 11.2 ms | **7.9 ms** | **−29%** |
| Consumables base (wall) | 21.3 ms | 20.9 ms | ~flat (PHP-dominated) |
| Staff dropdown for logs | ~44 ms / 4.8–5.2 KB (`GET /staffs`) | **10.6 ms / 0.9 KB** (`/staffs/options/query`) | **−76% wall · −83% payload** |
| Commission `recalculateAllMonthly` (8 monthly rows) | 58.6 ms / 16 q | **44.5 ms / 9 q** | **−24% wall · −44% queries** |
| Staffs list / tiers list | already light | unchanged ~flat | — |

### Recalc query-count (same 9 monthly rows)

| Mode | Queries (median) |
|------|-----------------:|
| Old (per-row tier SELECT) | ~1 + 2×rows (tier+save each) |
| New (preloaded tiers) | **2** (load tiers once + chunk updates) |

## Routes

```
// NEW ENHANCEMENT
GET /api/staffs/options/query
```

Legacy `GET /api/staffs` kept as `// OLD QUERY`.
