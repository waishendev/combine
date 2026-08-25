# Customers + Customer Types Query Enhancement — ANALYSIS v1 (2026-08-25)

Enhancement id: `customers-query-v1` (+ v1b history pagination / show slim)

## What landed

### Indexes (`2026_08_25_000800_…`)
- `customers (created_at DESC, id DESC)`
- `customers (customer_type_id)`
- `customers (is_active, created_at DESC)`, `(tier, created_at DESC)`
- `points_earn_batches (customer_id)` + partial `(customer_id, expires_at) WHERE points_remaining > 0`

### Query changes
- `GET /customers` list: after paginate, **2 batched** aggregates (`WHERE customer_id IN (…)`) instead of 2×N
- Same JSON keys: `available_points`, `spent_in_window`, `next_tier`, `amount_to_next_tier`
- CSV export: batched member points
- Show/details: one query for available+earned points; `loadMissing(customerType)`; expose `customer_type` name

### History FE (v1b)
- Show **20 / 50 / 100** + Previous/Next via `PaginationControls` (URL `page` / `per_page`)
- Split load: profile+wallet once; reports only for active tab / page
- Default date = last **12 months**; **All time** sets `2000-01-01`→today
- Summary totals from `grand_totals` / `pagination.total` (not current page sum)

## Benchmark (local · median of 5)

| Call | Before | After | Δ wall | Δ queries |
|------|-------:|------:|-------:|----------:|
| `/customers` ×50 | 257 ms / ~103 q | **68 ms / 18 q** | **−73%** | **−83%** |
| `/customers` ×15 | 85 ms / ~34 q | **30 ms / 18 q** | **−65%** | **−47%** |
| `/customers?name=a` ×50 | 263 ms | **70 ms / 18 q** | **−73%** | |
| `/customers?search=a` ×50 | 274 ms | **71 ms / 18 q** | **−74%** | |
| `/customers/{id}` show | 16 ms / 21 q | **15 ms / 18 q** | slight | **−14%** |
| `/customer-types` ×200 | 5 ms | 5 ms | flat | |

## EXPLAIN (after)

| Query | Plan |
|-------|------|
| Points sum by customer | **Index Scan** `peb_customer_remaining_expires_idx` |
| List `ORDER BY created_at DESC LIMIT 50` | **Index Scan** `customers_created_at_id_idx` |

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| Extra indexes | Slightly slower customer / points-batch writes |
| History default 12 mo | First paint shows less until All time |
| History pagination | More clicks to see deep history; much less data per request |

## Routes marked

`routes/api.php` — `// NEW ENHANCEMENT — customers-query-v1` around `GET /customers`.
