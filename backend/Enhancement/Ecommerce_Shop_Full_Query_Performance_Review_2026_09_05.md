# Ecommerce Shop — Full Query Performance Review (2026-09-05)

**Scope:** All routes under `frontend/ecommerce_gentlegurl_shop/src/app` (+ shared layout/header/cart providers), traced to `backend/ecommerce_gentlegurl_backend_api` public APIs.

**Constraint:** Analysis only — no business logic / API shape / UI / pagination behavior changes in this pass.

**Environment (local Postgres):** products=253 (active shop≈240) · variants=658 · media=791 · orders=1,037 (paid=982) · order_items=2,284 · carts=1,302 · customers=661 · median of 5 controller benches.

**Prior related work (partial overlap only):** CRM Products/Categories, Catalog Menus, Wishlist report, Orders/Returns (public returns already enhanced), Membership tiers. **No prior dedicated public catalog / cart / account-orders / checkout / homepage sold-count review.**

---

## Executive summary

| Area | Local wall | Queries | Top risk |
|------|-----------:|--------:|----------|
| `GET /public/shop/products` | ~75–90 ms | 8–9 | Full variants+all images per card; sold-count; `Schema::hasColumn` introspection; Seq Scan list sort |
| `GET /public/shop/products/{slug}` | ~46 ms | 17 | Deep graph + related + sold-count |
| `GET /public/shop/homepage` cold | ~405 ms | 21 | 3× product sections with full `with` |
| Homepage **warm** (cache hit) | ~326 ms | **21** | **Sold-count + wishlist still run after `Cache::remember`** |
| Cart show | ~3 ms | 2 | Empty guest OK; formatCart loads all images+variants when items exist |
| Account orders (sparse customer) | ~7 ms | 2 | Deep eager graph — scales with items/orders |
| FE global stack | n/a | n/a | **Duplicate homepage / overview / wallet / wishlist / cart** |

**Priority themes**

1. **P0 FE:** Deduplicate mount fetches (`getHomepage`, account overview, wallet, wishlist) without changing payloads.
2. **P0 BE:** Stop per-request `Schema::hasColumn` in sold-count; slim list/cart eager loads (cover image only) **if** response can stay identical via same computed fields.
3. **P1 BE:** Composite shop list index; fold homepage sold-counts into cache or batch cheaper; sold-count join efficiency.
4. **P2:** Denormalized `sold_count`, specialized list endpoints, checkout preview caching — recommend only.

---

## ACTION / navigation note

Shop “actions” are mostly **API mutations + in-flow navigation** (cart→checkout→payment-result, account orders→detail→returns). None of the review findings require changing those flows. Where Action-like controls navigate (order detail → return create, invoice GET), the target APIs are included below.

---

## A) Cross-cutting frontend duplicate calls (P0)

### A1. Homepage fetched multiple times per document

| # | Item | Detail |
|---|------|--------|
| 1 | Pages / actions | Almost every SSR page via `layout.tsx` + `ShopHeader` + often `page.tsx` / `generateMetadata` / product / services |
| 2 | Frontend | `src/lib/server/getHomepage.ts` (`cache: "no-store"`); callers: `app/layout.tsx`, `ShopHeader.tsx`, `app/page.tsx`, `product/[slug]/page.tsx`, `services/[slug]/page.tsx`, `manifest.ts` |
| 3 | API | `GET /api/proxy/public/shop/homepage?type=ecommerce` (+ optional `session_token`) |
| 4 | Backend | `PublicHomepageController@show` |
| 5 | Pattern | Shared JSON blob; FE issues **2–3 HTTP calls** per navigation |
| 6 | Why slow | Multiplies backend work; even on Laravel cache hit, post-cache sold-count still runs per call |
| 7 | Indexes | N/A (orchestration) |
| 8 | EXPLAIN | N/A |
| 9 | Recommendation | Wrap `getHomepage` in `React.cache()` (or single layout fetch + props). Optional Next `unstable_cache` with short TTL **only if** session wishlist flags remain correct |
| 10 | Benefit | −50–66% homepage HTTP volume on typical pages |
| 11 | Trade-off | Must keep per-request cookies/session for wishlist flags |
| 12 | Safe? | **Yes** if request-scoped memo only (no cross-user cache) |

### A2. Account overview / wallet / wishlist remount duplicates

| Callers | APIs |
|---------|------|
| Root layout `getUser()` | `GET /public/shop/account/overview` |
| `account/layout.tsx` `getUser()` | same again |
| `/account` client | `GET /public/auth/profile` + overview again |
| Header (logged in) | `GET /public/shop/customer/wallet` + `GET /public/shop/wishlist` |
| `/account`, `/account/wallet` | wallet again |
| `/wishlist` + header | wishlist again |
| Every page | `GET /public/shop/cart` via `CartProvider` |

| # | Recommendation | Safe? |
|---|---------------|-------|
| 9 | Request-memo overview; share wallet/wishlist from layout/context; avoid remount fetches when data already loaded | **Yes** (FE-only) |
| 10 | Cuts 2–4 auth/bootstrap queries per account page | |

### A3. Checkout mount burst

| Mount APIs | Notes |
|------------|-------|
| addresses, **homepage** (gateways), billplz options ×2, promotions, store-locations, bank-accounts, vouchers, checkout/preview | Homepage reused as gateway source; vouchers/promos already loaded on cart |

**P1:** Serve gateways from a slim endpoint already on homepage payload via FE state, or `payment-methods` — **without** changing checkout math. Preview debounce already present; keep.

---

## B) Catalog — shop listing & search

### B1. Product list over-fetches relations + sold counts

| # | Item | Detail |
|---|------|--------|
| 1 | Page / action | `/shop`, `/shop/[slug]`, header search |
| 2 | Frontend | `ShopBrowser` → `/api/proxy/public/shop/products?...` |
| 3 | API | `GET /public/shop/products` |
| 4 | Backend | `PublicShopController@products` |
| 5 | Pattern | `with(categories, **all images**, **all active variants**, video)` → paginate → `calculateRealSoldCountsForProducts` (2 aggregations + **`Schema::hasColumn`**) |
| 6 | Why slow | List UI needs cover + price range, not full gallery/every variant row; sold-count `whereHas(order paid)` over `order_items`; schema introspection ~2 ms every request |
| 7 | Indexes | `products (is_active, name)` (dup); `products (is_reward_only, id)`; `product_categories (category_id)`; `order_items (product_id, order_id)` partial product lines. **Missing** shop filter+sort composite |
| 8 | EXPLAIN (list sort) | `Seq Scan products` (240 rows) → Sort `created_at DESC` → Limit 15 · ~0.18 ms. Fine locally; grows with catalog |
| 8b | EXPLAIN (sold SUM) | Nested Loop / Hash Semi Join; **Seq Scan order_items** (2284) · ~0.6 ms |
| 9 | Recommendations | **P0:** Cache/remove `Schema::hasColumn` for `product_variant_id`. **P0/P1:** Eager-load only cover image (`sort_order` first / limit 1) + min columns for variants used by `buildProductPricingSummary` — **preserve JSON fields** (`images` array can still be built from one cover if FE only shows cover — verify FE). **P1:** Index `(is_active, is_hidden_in_shop, is_reward_only, created_at DESC)` and `(…, price)` for sort. **P1:** Sold-count via `JOIN orders` / partial index `(product_id) WHERE …` or maintain counter (P2) |
| 10 | Benefit | Fewer rows hydrated; less I/O as media/variants grow; remove fixed schema tax |
| 11 | Trade-off | Slim `with` must keep identical response keys/values |
| 12 | Safe? | Schema fix **yes**. Slim eager **yes if** serialization unchanged. Index **yes**. Denormalized sold **P2** |

**Bench:** default ~75 ms / 9 q · `q=a` ~70 ms · `sort=price_asc` ~90 ms / 8 q.

### B2. Keyword search non-sargable

| # | Item | Detail |
|---|------|--------|
| 1–4 | `/shop` search / header | `PublicShopController@products` keyword branch |
| 5 | Pattern | `LOWER(name) LIKE %term%` AND across terms + `orWhereHas(variants…)` |
| 6 | Why slow | Leading wildcard; expression disables plain btree; variant EXISTS multiplies |
| 9 | P1: keep semantics; ensure short terms skipped (already &lt;2). P2: `pg_trgm` GIN on name/sku or dedicated search |
| 12 | Trgm = optional / write+storage cost |

### B3. Product detail

| # | Item | Detail |
|---|------|--------|
| 1 | `/product/[slug]` | SSR + reviews |
| 2 | `product/[slug]/page.tsx` — `getProduct` (+ `cache()` for metadata) vs page body may still double-hit depending on call sites; also `getHomepage` |
| 3 | `GET /public/shop/products/{slug}` (+ reviews, eligibility) |
| 4 | `PublicShopController@showProduct` |
| 5 | `with(categories, images, video, variants.bundleItems.componentVariant, packageChildren.childProduct)` + related×4 + sold-count |
| 6 | Deep graph OK for PDP; related + sold add cost; FE may fetch product twice |
| 8 | Bench ~46 ms / 17 q |
| 9 | **P0 FE:** ensure single product fetch via `cache()`. **P1:** related select slim columns only (already maps thin). Sold-count same as B1 |
| 12 | FE memo **safe** |

---

## C) Homepage

| # | Item | Detail |
|---|------|--------|
| 1 | `/` + global chrome | |
| 3 | `GET /public/shop/homepage` | |
| 4 | `PublicHomepageController@show` | |
| 5 | `Cache::remember("public_homepage_v2_{$type}", 300)` builds sliders/menus + **new/best/featured** each `with([categories,images,variants])` limit 20. **After cache:** wishlist IDs + `calculateRealSoldCountsForProducts` on merged products + wallet gateway tweak |
| 6 | Cold path heavy; **warm still ~21 queries / ~326 ms locally** because sold-count/schema/wishlist are outside cache |
| 8 | Bench cold ~405 ms / 21 q · warm ~326 ms / 21 q |
| 9 | **P0:** Move sold-count into cached payload **or** cache sold map separately with short TTL; eliminate `Schema::hasColumn`. **P1:** Homepage product sections: cover-only images. **P0 FE:** React.cache homepage |
| 11 | Caching sold counts → slightly stale sold numbers (acceptable if TTL short) |
| 12 | Schema/FE memo safe; caching sold = low risk if documented |

---

## D) Cart & checkout

### D1. `formatCart` eager load

| # | Item | Detail |
|---|------|--------|
| 1 | Every page (`CartProvider`) + cart mutations | |
| 3 | `GET/POST/PATCH/DELETE /public/shop/cart…` | |
| 4 | `CartService::formatCart` | |
| 5 | `load(['items.product.images', 'items.product.variants', 'items.productVariant'])` — builds `available_variants` from **all** variants |
| 6 | Necessary for variant switcher UX; overkill if many images per product |
| 8 | Empty cart ~3 ms / 2 q (local) |
| 9 | **P1:** Restrict images to cover; only active variants (if inactive excluded today in map — align query). Do **not** change totals/fields |
| 12 | Safe if response identical |

### D2. Checkout preview / create

| # | Item | Detail |
|---|------|--------|
| 1 | `/checkout` field changes / submit | |
| 3 | `POST /public/shop/checkout/preview`, `POST /public/shop/orders` | |
| 4 | `PublicCheckoutController` + pricing/voucher/shipping services | |
| 5 | Multi-service; cart reload; eligibility checks |
| 9 | **P1:** Ensure preview debounce remains; avoid refetching full homepage for gateways (use slim list). **P2:** server-side preview cache keyed by cart hash — optional only |
| 12 | Gateway source change must keep same gateway list semantics |

---

## E) Account orders / returns / vouchers / wallet / loyalty

### E1. Order history deep eager load

| # | Item | Detail |
|---|------|--------|
| 1 | `/account/orders` | |
| 3 | `GET /public/shop/orders?scope=ecommerce_products` | |
| 4 | `PublicOrderHistoryController@index` | |
| 5 | `with([items.product.images, productVariant, review, booking…, payments])` + package usages batch + refunds batch + paginate |
| 6 | Correct batching for packages/refunds; product **images** for thumbnails may be replaceable by snapshot/cover |
| 7 | `orders (customer_id, created_at DESC)` — **good** (EXPLAIN uses it) |
| 8 | Sparse customer ~7 ms / 2 q; will grow with item graph |
| 9 | **P1:** Prefer snapshot thumbnails / `product:id,slug,type,cover` without full images collection if response can match. Keep booking graph only when scope needs it |
| 12 | Safe if serialized thumbnails unchanged |

### E2. Returns

Already covered by `orders-shop-returns-query-v2` (snapshot list, indexes). **Low residual risk** locally (0 returns).

### E3. Vouchers unbounded + per-row save

| # | Item | Detail |
|---|------|--------|
| 1 | `/cart`, `/checkout`, `/account/vouchers` | |
| 3 | `GET /public/shop/vouchers?status=active` | |
| 4 | `PublicVoucherController@index` | |
| 5 | `CustomerVoucher::with('voucher')->where(customer)->get()` then **each** may `$voucher->save()` if expired |
| 6 | Write amplification on read; no pagination (usually small) |
| 7 | Likely `(customer_id, …)` — confirm before adding; local table empty |
| 9 | **P1:** Bulk expire with one `UPDATE … WHERE end_at < now()` instead of N saves. **P2:** paginate only if product agrees (would change pagination — **out of scope** unless additive) |
| 12 | Bulk expire **safe** if same status transitions |

### E4. Wallet / loyalty / membership / wishlist

| Endpoint | Bench | Notes |
|----------|------:|-------|
| Wallet show / transactions | (not heavy) | Indexed `(customer_id, status, created_at)` pattern OK |
| Loyalty rewards | ~7 ms / 2 q | Small catalog |
| Membership tiers | prior review OK | |
| Wishlist index | ~2 ms | Unbounded; usually small; header duplicate is FE P0 |

---

## F) Other routes (brief)

| Route | APIs | Verdict |
|-------|------|---------|
| Login/register/password/verify | auth POSTs + wishlist/cart merge | Merge cost OK; one-time |
| Tracking | `POST …/orders/track` | Point lookup |
| Reviews page | settings + locations + paginated reviews | Cascading location GETs — **P1** combine if possible without shape change |
| Rewards / account/points | same loyalty rewards | FE duplicate of `/rewards` |
| Receipt / payment-result / thank-you | order lookup + cart reload | OK |
| Policies / flush | static / admin cache flush | Out of perf path |
| Services CMS | page + homepage | Homepage dup |

---

## Index recommendations (detail)

### I1. Shop product list (P1)

```text
CREATE INDEX … ON products (is_active, is_hidden_in_shop, is_reward_only, created_at DESC);
-- optional companion for sort=price_*:
CREATE INDEX … ON products (is_active, is_hidden_in_shop, is_reward_only, price);
```

| Supports | Default `/shop` filter + `ORDER BY created_at DESC` / price sorts |
| Partial cover today? | `(is_active, name)` and `(is_reward_only, id)` — **not** list sort |
| Trade-off | Extra storage; slight write cost on product updates |
| Benefit | Avoid Seq Scan+Sort as catalog grows (EXPLAIN already Seq Scan at 240 rows) |

### I2. Sold-count helpers (P1)

```text
-- strengthen paid product sales aggregation
CREATE INDEX … ON order_items (product_id) INCLUDE (quantity, order_id)
  WHERE product_id IS NOT NULL;
-- and/or ensure orders (payment_status, id) if filter selectivity needs it
```

| Partial cover? | `order_items_product_line_order_idx (product_id, order_id) WHERE product line` — helps some paths; EXPLAIN still Seq Scanned items at current size |
| Trade-off | Write cost on order_items |

### I3. Customer vouchers (P1 if volume grows)

```text
(customer_id, status, COALESCE/assigned sort key)
```

Only if EXPLAIN shows Seq Scan under real voucher volume.

---

## Prioritized plan (no code in this pass)

### P0 — very safe / high impact
1. FE: `React.cache` (or equivalent) for `getHomepage` + account `getUser` / overview.
2. FE: stop double wallet/wishlist on pages that already loaded header data (context).
3. BE: remove/hot-path-cache `Schema::hasColumn('order_items','product_variant_id')` in sold-count.
4. BE: investigate moving homepage sold-count **into** or beside cache (short TTL) so warm path ≠ cold query count.

### P1 — safe query improvements
1. Indexes I1 (and I2 if sold-count EXPLAIN still weak at prod scale).
2. Slim list/homepage/cart image eager-load to cover-only **preserving JSON**.
3. Voucher bulk expire instead of N×`save()`.
4. Checkout: don’t re-fetch full homepage solely for gateways.
5. Order list: avoid full `product.images` when snapshot/cover suffices.

### P2 — recommend only
1. Denormalized / maintained `products.real_sold_count`.
2. `pg_trgm` search.
3. Specialized slim list DTO endpoint (would be new contract — only if FE adopts).
4. Checkout preview result cache by cart hash.

---

## What is already healthy
- Public returns list (prior enhancement).
- Membership tiers.
- Orders customer list index `(customer_id, created_at)`.
- Cart session token index; empty cart cheap.
- Wishlist/loyalty small-set paths locally.
- No classic N+1 on product list (eager) or order package/refund batches.

---

## Evidence appendix (benches)

| Call | Wall | Q |
|------|-----:|--:|
| products page1 | 74.9 ms | 9 |
| products q=a | 69.6 ms | 9 |
| products price_asc | 89.9 ms | 8 |
| product show | 45.9 ms | 17 |
| menu | 51.5 ms | 2 |
| homepage cold | 405 ms | 21 |
| homepage warm | 326 ms | 21 |
| cart guest empty | 3.1 ms | 2 |
| account overview | 11.9 ms | 9 |
| orders ecommerce page1 | 6.6 ms | 2 |

Bench script: `backend/ecommerce_gentlegurl_backend_api/storage/app/_bench_shop_public.php`.

---

## Next step

Say **全部做了 + ANALYSIS** to implement **P0 + agreed P1** only (indexes, schema guard removal, FE request memo, cover-only eager loads with golden response checks). P2 stays recommendations.
