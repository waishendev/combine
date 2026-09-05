# Ecommerce Shop — Query Enhancement ANALYSIS v1 (2026-09-05)

Enhancement id: `ecommerce-shop-query-v1`

**Shop surfaces:** catalog list/PDP, homepage, cart thumbs, checkout gateways, account orders list, vouchers, FE bootstrap (homepage / overview / wallet).

**Review:** `Ecommerce_Shop_Full_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / checkout math / list pagination / ACTION navigation changes. Response keys preserved (list `images` may be cover-only).

**Environment:** Local Postgres · products=253 (active shop≈240) · variants=658 · media=791 · orders=1,037 (paid=982) · order_items=2,284 · median of 5 controller benches.

**Out of scope (P2):** denormalized `sold_count`, `pg_trgm` search, checkout preview cache.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| Homepage **warm** | ~326 ms / **21 q** | **~10 ms / 1 q** | Sold-count + product graph inside cache; cache plain arrays (no variant `derived_*` N+1) |
| Homepage cold | ~405 ms / 21 q | ~356 ms / 35 q | Sold-count moved into cold build; warm path fixed |
| Checkout `getPaymentGateways` | full homepage (~warm cost) | **~4 ms / 1 q** | Slim `GET /public/shop/payment-gateways` |
| Shop products list | ~75–90 ms / 8–9 q | ~70–84 ms / **6–7 q** | Drop `Schema::hasColumn` + video; coverImage; composite index |
| List SQL sort | Seq Scan + Sort | **Index Scan** `products_shop_list_created_at_desc_idx` | ~0.05 ms |
| Cart / orders list | full `product.images` | `coverImage` only | Same thumb fields |
| Vouchers expire | N×`save()` | 1×`whereIn` update | Same status semantics |
| FE homepage SSR | 2–3 HTTP / nav | **1** via `React.cache` | Request-scoped |
| FE account page | profile + overview | profile; loyalty from Auth | −1 overview |
| FE wallet header+account | 2× wallet | shared 30s cache | Deduped mount |

ACTION / checkout flow unchanged: cart → checkout → payment-result; orders → detail / returns; gateways payload shape unchanged.

---

## What landed

### FE
- `getHomepage` / `getAccountOverview` wrapped in `React.cache`.
- `walletSharedCache` shared by `ShopHeaderClient` + `WalletBalanceSection` (force refresh after top-up).
- `/account` uses AuthContext loyalty; skips remount `getAccountOverview`.
- `getPaymentGateways()` → `/public/shop/payment-gateways?type=ecommerce`.

### Backend
- `Product::coverImage()` + accessor prefers loaded cover.
- List / homepage / cart / order-list eager `coverImage` (PDP keeps full gallery).
- Homepage cache key `public_homepage_v3_*`: sold-counts + pricing attrs computed inside remember; products stored as arrays; post-cache only wishlist + wallet gateway filter.
- Removed per-request `Schema::hasColumn('order_items','product_variant_id')`.
- `PublicVoucherController`: bulk expire update.
- Slim `PublicHomepageController@paymentGateways`.

### Indexes
Migration: `2026_09_05_000600_add_ecommerce_shop_query_indexes.php`

| Index | Table |
|-------|--------|
| `(is_active, is_hidden_in_shop, is_reward_only, created_at DESC)` | `products` |
| `(is_active, is_hidden_in_shop, is_reward_only, price)` | `products` |

### Routes tagged
`routes/api.php` — `ecommerce-shop-query-v1` on products, homepage, payment-gateways, orders index, vouchers index.

---

## EXPLAIN highlights (after)

**Shop list default sort**
```text
Index Scan using products_shop_list_created_at_desc_idx
Index Cond: (is_active AND NOT hidden AND NOT reward_only)
Execution Time: ~0.05 ms
```

---

## Residual / not done (P2)

- Denormalized / maintained `sold_count` (list still runs 2 aggregations).
- `pg_trgm` / dedicated search for `LOWER(name) LIKE %term%`.
- Slim variants on list (still needed for price range / sale display).
- Wishlist FE shared cache (header vs wishlist page) — lower priority than homepage/wallet.
- Homepage cold still builds three sections + sold-count (~35 q); acceptable for 5‑min TTL.

---

## Files touched (high level)

**FE:** `getHomepage.ts`, `getAccountOverview.ts`, `walletSharedCache.ts`, `ShopHeaderClient.tsx`, `WalletBalanceSection.tsx`, `account/page.tsx`, `apiClient.ts`  
**BE:** `Product.php`, `PublicShopController.php`, `PublicHomepageController.php`, `CartService.php`, `PublicOrderHistoryController.php`, `PublicVoucherController.php`, `routes/api.php`, migration `000600`
