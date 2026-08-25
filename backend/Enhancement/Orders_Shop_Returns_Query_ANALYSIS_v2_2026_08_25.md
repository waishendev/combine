# Orders + Shop Returns — Query ANALYSIS (v2 · 2026-08-25)

Enhancement id: `orders-shop-returns-query-v2`

**Baseline for deltas:** v1 post-enhance medians (Completed 176 / New 65 / All 169 / Date 166 ms).  
**Original pre-v1:** Completed 285 / New 88 / All 161 / Date 243 ms.

## What landed

| Item | Change |
|------|--------|
| `orders.is_booking_checkout` | Denormalized flag + backfill from notes / booking line_types / `order_service_items` |
| Booking cart create | `CartController` sets `is_booking_checkout = true` |
| List scopes | Prefer flag (indexed); legacy `whereHas` only for unflagged rows |
| `GET /api/ecommerce/orders/query` | Slim column select + `simplePaginate` (no COUNT) |
| CRM `OrdersTable` | Wired to `/orders/query`; pagination uses `has_more` / synthetic `last_page` |
| `order_number` search | `%LIKE%` kept; Postgres `pg_trgm` GIN on shop orders |
| Shop returns list | Snapshot-only order items (no live `product` / `images` join) |
| Order `show` | Batch package-claim load for all booking ids; pass into `mapBookingDetail` |

Legacy `GET /orders` kept for PosRequestCenter / other callers (still uses flag-aware scopes + COUNT paginate).

## Dataset (local)

| Metric | Count |
|--------|------:|
| Shop orders (`created_by_user_id IS NULL`) | 85 |
| `is_booking_checkout = true` (all orders) | 545 |
| `return_requests` | 0 |

## Benchmark (median of 5 · wall)

| Path | v1 after | **v2 `/orders/query`** | vs v1 | vs original |
|------|---------:|-----------------------:|------:|------------:|
| All | 169 ms | **67 ms** | **−61%** | −59% |
| New | 65 ms | **66 ms** | ~flat | −25% |
| Completed | 176 ms | **65 ms** | **−63%** | **−77%** |
| Date range | 166 ms | **60 ms** | **−64%** | −75% |
| Shop returns (empty) | 6 ms | 8 ms | ~flat | — |

Also: legacy `/orders` Completed (same flag scopes + COUNT) ≈ **104 ms** (−41% vs v1 Completed) — flag alone helps even without `simplePaginate`.

| Extra | Wall | Notes |
|-------|-----:|-------|
| `order_no` LIKE via `/orders/query` | 97 ms | Trigram ready; n=85 still tiny |
| SQL time `/orders/query` ALL | ~8 ms | vs ~11 ms legacy COUNT path |
| Queries `/orders/query` ALL | 7 | Legacy 8 (no pagination COUNT) |

## Why Completed improved most

v1 Completed still paid for `notes LIKE '%Booking cart checkout%'` / `whereHas` booking detection inside `include_paid_booking_completed`. v2 resolves most booking rows with `is_booking_checkout = true` (partial index `(is_booking_checkout, created_at)` for shop).

## Semantics / UX notes

- List row JSON keys unchanged for CRM table.
- Shop returns list: `cn_name` / cover image may be empty → shop uses placeholder; **detail** (`GET /returns/{id}`) still loads live product/images.
- Pagination: no exact `total`; Next enabled while `has_more` / `next_page_url`.

## Routes

```
// OLD QUERY
GET /api/ecommerce/orders

// NEW ENHANCEMENT — orders-shop-returns-query-v2
GET /api/ecommerce/orders/query
GET /api/public/shop/returns
```

## Migration

`2026_08_25_000500_add_orders_booking_flag_and_trgm.php` (applied locally).
