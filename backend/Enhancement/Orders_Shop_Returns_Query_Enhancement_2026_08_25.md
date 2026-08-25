# Orders + Shop Returns Query Enhancement (2026-08-25)

Enhancement id: `orders-shop-returns-query-v1`

## What landed

### Indexes (`2026_08_25_000400_…`)
- `orders (store_location_id, created_at DESC) WHERE created_by_user_id IS NULL`
- `orders (status, created_at DESC) WHERE created_by_user_id IS NULL`
- `orders (created_by_user_id) WHERE created_by_user_id IS NOT NULL`
- `return_requests (customer_id, created_at DESC)`, `(order_id)`
- `return_request_items (return_request_id)`
- `booking_refunds (return_request_id) WHERE return_request_id IS NOT NULL`

### CRM `OrderController@index`
- Sargable `created_at` / `pickup_ready_at` ranges (no `whereDate`)
- Return summary via `returns` + `withSum(items)` (no nested `returns.items` rows)
- Stable `return_summary` JSON unchanged

### Shop `PublicReturnController@index`
- Eager `product.images` (kills `cover_image_url` N+1)
- Slim `order:id,order_number` + product/variant columns
- Batch `refundPayloadsForReturns` (no per-row queries; **no receipt-token INSERT on list**)
- Cap `per_page` 1–100
- Shop `getReturns()` requests `per_page=100`

## Benchmark (local · median of 5 · 85 shop orders · 0 returns)

| Path | Before | After | Delta |
|------|--------|-------|-------|
| **/orders/completed** wall | 285 ms | **176 ms** | **−38%** |
| **/orders/new** wall | 88 ms | **65 ms** | **−26%** |
| All + date range wall | 243 ms | **166 ms** | **−32%** |
| All list wall | 161 ms | 169 ms | ~flat (PHP noise; n=85) |
| Shop returns (empty) | 7 ms | 6 ms | ~flat |

**Note:** With only ~85 shop rows, Postgres still prefers Seq Scan for the default list; indexes are verified usable (`enable_seqscan=off` → Bitmap Index Scan on shop partial indexes) and matter as volume grows. Completed/New wins come mainly from lighter return assembly + sargable dates.

## Routes marked

`// NEW ENHANCEMENT` on `GET /api/ecommerce/orders` and `GET /api/public/shop/returns`.
