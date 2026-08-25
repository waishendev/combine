# CRM Orders + Shop Returns — Query Performance Review (2026-08-25)

**Scope:** CRM `/orders`, `/orders/new`, `/orders/completed`; Shop `/account/returns`  
**Constraint:** Analysis only — no business logic / API / response / UX changes.  
**Environment:** Local Postgres · superadmin · dataset below (returns empty locally — structural risks still apply).

## Dataset (local)

| Metric | Count |
|--------|------:|
| `orders` total | 596 |
| `orders` shop (`created_by_user_id IS NULL`) | 85 |
| `order_items` | 1,483 |
| `return_requests` | **0** |
| `return_request_items` | 0 |

---

## Page → API map

### CRM orders (All / New / Completed)

| Page | First-paint list API | Extra params |
|------|----------------------|--------------|
| `/orders` | `GET /api/ecommerce/orders?page&per_page&branch…` | — |
| `/orders/new` | same | `status[]` (active set) + `payment_status[]` + **`exclude_paid_booking=1`** |
| `/orders/completed` | same | `status[]=completed,cancelled` + **`include_paid_booking_completed=1`** |

Shared: `GET /api/me/store-locations` (BranchContext).  
View panel (not first paint): `GET /ecommerce/orders/{id}` (heavy); optional `GET /pos/appointments/{id}`.

Controller: `OrderController@index`  
SSR only auth — list is client-fetched.

### Shop returns

| Call | API |
|------|-----|
| SSR list | `GET /api/public/shop/returns` via `getReturns()` (no page params) |

Controller: `PublicReturnController@index` — paginate default **15**; shop UI **ignores** further pages.

---

## 1. CRM orders list — query shape

```text
Order::with([
  storeLocation:id,name,code,
  customer:id,name,email,phone,
  items:id,order_id,line_type,
  serviceItems:id,order_id,
  returns:id,order_id,status,created_at,
  returns.items:id,return_request_id,quantity,
])
  ReportBranchScope(store_location_id)
  whereNull(created_by_user_id)          -- shop only
  + status / payment_status / exclude|include booking scopes
  + optional order_no LIKE %…%, whereDate(created_at)
  orderByDesc(created_at)
  paginate  -- COUNT(*) + page
```

**Booking scopes** (`applyBookingOrderScope` / `applyNonBookingOrderScope`):

- `whereHas(items.line_type IN booking_*)` / `whereDoesntHave`
- `orWhereHas(serviceItems)`
- `notes LIKE '%Booking cart checkout%'` (leading wildcard — not indexable)

### Benchmark (median of 5)

| Path | Wall | SQL | Q | Payload |
|------|-----:|----:|--:|--------:|
| **All** branch `per_page=50` | 161 ms | 11 ms | 9 | 31.5 KB |
| All branches | 176 ms | 12 ms | 9 | 31.4 KB |
| **New** + `exclude_paid_booking` | 88 ms | 13 ms | 8 | 7.4 KB |
| **Completed** + `include_paid_booking` | **285 ms** | 16 ms | 9 | 31.4 KB |
| + `order_no` LIKE | 271 ms | 12 ms | 9 | 31.5 KB |
| + date range (`whereDate`) | 243 ms | 12 ms | 9 | 31.5 KB |

List path itself is **not classic N+1** (eager `with`); ~9 queries = count + page + relation loads.

### EXPLAIN ANALYZE — shop list (branch + `created_by_user_id IS NULL`)

```text
Seq Scan on orders
  Filter: created_by_user_id IS NULL AND store_location_id = 1
  → Sort created_at DESC → Limit 50
Execution ~0.41 ms (tiny table); buffers=40
```

**Root cause:** No composite supporting CRM default filter + sort. Existing indexes (`payment_status,status`, `store_location_id,payment_status`, `customer_id,created_at`) miss this path.

### Indexes present vs gaps (`orders`)

| Index | Present? | Helps |
|-------|----------|-------|
| `orders_payment_status_status_index` | Yes | New/Completed status filters |
| `orders_store_location_payment_status_index` | Yes | New path (seen in EXPLAIN) |
| `orders_customer_id_created_at_index` | Yes | Customer history (not CRM list) |
| `orders_order_number_unique` | Yes | Exact match only — **not** `%LIKE%` |
| `(store_location_id, created_at DESC) WHERE created_by_user_id IS NULL` | **No** | Default All/New/Completed list |
| `created_by_user_id` | **No** (only as FK possibly) | Shop-vs-POS filter |

### Findings — CRM orders

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P0** | Default list seq-scan + sort | Missing partial/composite for shop + branch + `created_at` | `CREATE INDEX … ON orders (store_location_id, created_at DESC) WHERE created_by_user_id IS NULL` | Small partial index; shop inserts only |
| **P0** | Completed path slowest (285 ms wall) | `(status IN …) OR (booking EXISTS AND paid)` + notes LIKE | Prefer denormalized `order_kind` / flag over `notes LIKE`; keep EXISTS on `line_type` with `order_items (order_id, line_type)` (already have line_type indexes) | Flag needs backfill; behavior-preserving if derived same way |
| P1 | `whereDate(created_at)` | Non-sargable cast | `created_at >= startOfDay AND < nextDay` | Same results if timezone mapped carefully |
| P1 | `order_no LIKE '%…%'` | Leading wildcard | Prefer prefix `LIKE 'X%'` or trigram GIN if substring required | Trigram = storage + write cost |
| P1 | Eager returns tree on every list row | Summary only needs counts/status | `withCount` / latest return subquery instead of full `returns.items` | Response shape must stay same — map identically |
| P2 | Dual COUNT pagination | Laravel paginator | Index above helps; `simplePaginate` only if UX OK | Meta change |
| P2 | Dead FE filters `customer_name` / `customer_email` | Sent but unused by backend | Document / implement later | — |
| OK | List N+1 | Eager-loaded | — | — |

**View panel (secondary):** deep `show` graph + possible `mapBookingDetail` package-claim N+1 — separate from list first paint; flag for later.

---

## 2. Shop `/account/returns`

### Query shape

```text
ReturnRequest::with([order, items.orderItem.product, items.orderItem.productVariant])
  where customer_id = ?
  withCount(items) + withSum(quantity)
  latest() → paginate(15)
  transform each row:
    refundPayloadForReturn(id)   -- findRefund + maybe CREATE receipt token
    product.cover_image_url      -- images()->get() if images not eager-loaded
```

### Benchmark (local · 0 returns)

| Call | Wall | SQL | Q |
|------|-----:|----:|--:|
| Index page 1 | 7 ms | 1 ms | 1 (empty count only) |

Empty dataset hides N+1; **code path still high risk** in production.

### EXPLAIN — `WHERE customer_id ORDER BY created_at`

Seq Scan + sort (table empty). Live DB indexes on `return_requests`:

```text
ONLY return_requests_pkey
```

**Critical:** `foreignId('customer_id')` / `order_id` indexes are **missing** in this database (only PK). Same for `return_request_items` (only PK — no `return_request_id` index visible).

### Findings — shop returns

| Pri | Issue | Root cause | Safe recommendation | Trade-offs |
|----:|-------|------------|---------------------|------------|
| **P0** | Missing FK/list indexes | Live: no `customer_id` / `order_id` indexes on `return_requests`; no `return_request_id` on items | `CREATE INDEX … (customer_id, created_at DESC)`; `(order_id)`; items `(return_request_id)` | Tiny write cost; large read win |
| **P0** | Per-row refund + receipt on GET | `refundPayloadForReturn` → 1–2 queries/row; **may INSERT** receipt token | Batch refunds by `return_request_id IN (…)`; create tokens lazily on receipt click / `show` | Avoid write-on-read; same URLs if token created once |
| **P0** | `cover_image_url` N+1 | Index eager-loads `product` but **not** `product.images`; accessor runs `images()->get()` | `with('…product.images')` like `show` already does | Slightly larger eager payload |
| P1 | Over-fetch full order/product/variant | List mostly needs snapshots + cover | Select narrow columns / snapshots only | Keep response keys identical |
| P1 | Shop ignores pagination | API `per_page=15`; UI never loads page 2+ | Pass `per_page` / pager in FE **or** raise limit with care | UX completeness (behavior change if pager added) |
| P2 | Unused response fields | `reason`, `refund_method`, proofs, etc. unused on list | Slim later via new enhancement endpoint | Don’t strip without FE check |

---

## Cross-page priority board

1. **Orders:** partial index `(store_location_id, created_at DESC) WHERE created_by_user_id IS NULL`
2. **Returns:** restore/add `(customer_id, created_at DESC)` (+ item/order FKs)
3. **Returns:** batch refunds + eager `product.images`; stop token insert on list GET
4. **Orders Completed:** reduce `notes LIKE` dependency; sargable dates
5. **Orders list:** lighter return summary assembly (same JSON)

## What not to change casually

- Status OR rules for New (`exclude_paid_booking`) / Completed (`include_paid_booking_completed`)
- Response keys for order list / return list
- Shop auth (`customer` guard) and customer scoping
