# Membership / Loyalty Settings / Store — Query Performance Review (2026-08-25)

**Scope**
- Shop `/membership` (`ecommerce_gentlegurl_shop`) — public tier cards (+ auth loyalty context if logged in)
- CRM `/loyalty-settings` — LoyaltySettingsForm (load + save)
- CRM `/store` — Branch Management list + Create / Edit modals + `/store/[id]` detail
- Sibling (related data): CRM `/membership` tier CRUD (same `membership_tier_rules` table as shop)

**Constraint:** Analysis only — no business logic / API / UX changes.  
**Environment:** Local Postgres · 3 tier rules · 1 loyalty setting · 2 store locations · 2 store images · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries | Payload | Verdict |
|------|-----:|--------:|--------:|---------|
| `GET /public/shop/membership/tiers` | **~3 ms** | 3 | 0.4 KB | OK |
| `GET /ecommerce/loyalty-settings` | **~6 ms** | 6 | 0.4 KB | OK (tiny table; redundant 2nd query) |
| `GET /ecommerce/membership-tiers` ×50 | **~6 ms** | 6 | 1.5 KB | OK |
| `GET /ecommerce/store-locations` ×15/50 | **~13 ms** | ~5–15* | 2.1 KB | OK now; scale risks |
| `GET /ecommerce/store-locations/{id}` | **~6 ms** | 3 | 1.2 KB | OK |

\*Bench multi-run listener stacking inflated store q counts; a single instrumented list call used **5 queries** (including **duplicate `COUNT(*)`**).

**None of these three pages are currently “slow” in local data.** Risks are mostly **missing indexes / redundant counts / over-fetching images on list** that will bite when branches grow.

---

## Page → API map

### Shop `/membership`
| UI | API | Notes |
|----|-----|--------|
| Tier grid | `GET /api/public/shop/membership/tiers` | Active rules only |
| Logged-in progress (optional) | Auth profile / loyalty summary | Not from this page’s `getMembershipTiers`; `refreshProfile` unused on page |

### CRM `/loyalty-settings`
| UI | API |
|----|-----|
| Load form | `GET /ecommerce/loyalty-settings` → `{ current, history }` |
| Save | `PUT /ecommerce/loyalty-settings/{id}` |

No Create/Delete UI on this page (controller still has store/destroy).

### CRM `/store`
| UI | API |
|----|-----|
| List / filter / page | `GET /ecommerce/store-locations` (+ `branch_usage`) |
| Create | `POST /ecommerce/store-locations` |
| Edit modal | `GET` then `PUT /ecommerce/store-locations/{id}` |
| Detail `/store/[id]` | `GET /ecommerce/store-locations/{id}` |
| Delete | Disabled in FE (`canDelete = false`); API returns 422 |

### Sibling CRM `/membership` (tier admin)
| UI | API |
|----|-----|
| List / Create / Edit / Delete / move-up/down | `/ecommerce/membership-tiers…` |

---

## Root causes & EXPLAIN

### 1. Store list: duplicate `COUNT(*)` (easy win later)

`StoreLocationController@index` paginates (Laravel count) **and** `BranchCapacityService::usage()` runs another `StoreLocation::count()`.

**Query log (×15):**
```
count(*) from store_locations          -- paginator
select * from store_locations … limit
select * from store_location_images where store_location_id in (…)
select * from settings where type=? and key=?
count(*) from store_locations          -- branch_usage again
```

**Recommendation:** Reuse paginator `total()` for usage count when unfiltered, or cache limit+count once per request. **Low risk** if `branch_usage.count` stays identical when no filters; when filters applied, capacity count should remain **unfiltered** (current behavior) — keep a dedicated unfiltered count, but avoid double-count when filters empty.

### 2. Store list: eager-loads **all** images

List `with('images')` while table mainly needs a primary thumbnail. Detail/edit need full set.

**EXPLAIN** images by store: Seq Scan (2 rows). Fine now.

**Missing index:** `store_location_images (store_location_id, sort_order)` — only PK today.

**Recommendation:** Index FK; optionally list with `with(['images' => limit 1])` or a `cover_image` relation — **behavior-safe if response still includes `images` array** (maybe length 1) or FE only uses first. Prefer index-only first (zero API shape change).

### 3. Store list sort: Seq Scan + Sort

**EXPLAIN** `ORDER BY sort_order, name LIMIT 50`:
```
Sort → Seq Scan on store_locations (2 rows) · 0.09 ms
```

Existing indexes are for booking/pickup/POS filters, **not** admin list `(sort_order, name)`.

**Recommendation:** `store_locations (sort_order, name)` — helps when branch count grows. Trade-off: slight write cost on create/update.

### 4. Loyalty settings: load history + re-query “current”

```php
$settings = LoyaltySetting::orderByDesc(...)->get();
'current' => $this->getActiveSetting(), // second SELECT
```

At 1 row: **~6 ms**. Redundant round-trip.

**Missing index:** `(rules_effective_at DESC, created_at DESC)` — only PK.

**Recommendation:** Derive `current` from already-loaded `$settings` in PHP **or** add index for active lookup. Deriving current preserves response shape with **zero extra query**.

### 5. Membership tiers (shop + CRM)

**EXPLAIN** active tiers: Seq Scan + Sort · **0.10 ms** (3 rows).

Indexes today: **PK only**.

**Recommendation (scale):**
- `(is_active, min_spent_last_x_months, sort_order)` for public endpoint
- `(sort_order)` for CRM list / move-up/down neighbors

Trade-off negligible; table is tiny.

Public `membershipTiers` maps via `formatTierData` (no N+1 — badge URL is local Storage path).

### 6. Shop membership + auth loyalty (adjacent)

Page reads `customer?.loyalty.*` from AuthContext. If profile refresh runs `buildLoyaltyProgress`, that **sums orders** per customer (indexed by `orders_customer_id_created_at` / coalesce index) — separate from tiers API. Not a list N+1; mention only if profile feels slow.

---

## Recommended safe optimizations (do not apply in this review)

| # | Change | Why | Trade-off | Behavior risk |
|---|--------|-----|-----------|---------------|
| **P1** | Index `store_location_images (store_location_id, sort_order)` | Eager image load on list/show | +storage | None |
| **P1** | Index `store_locations (sort_order, name)` | Admin list sort | +storage | None |
| **P1** | Avoid double `COUNT(*)` on store index when unfiltered | −1 query every list load | Careful with filtered lists | Low |
| **P2** | Derive loyalty `current` from loaded history collection | −1 query on settings page | None | None if same “active” rule |
| **P2** | Index `loyalty_settings (rules_effective_at DESC, created_at DESC)` | Faster active lookup at history growth | +storage | None |
| **P2** | Index `membership_tier_rules (is_active, min_spent…, sort_order)` | Public + CRM sorts | +storage | None |
| **P3** | Slim store list images (cover only) | Smaller payload | Must keep FE happy | Medium if FE expects all images on list |

**Already OK / skip:** Loyalty form PUT; store create capacity lock; delete disabled; membership CRUD at 3 rows.

---

## Suggested apply order (when approved)

1. Migration: store images FK index + store `(sort_order, name)` + optional loyalty/tier indexes.  
2. Store index: single unfiltered count shared with `branch_usage` when no filters.  
3. Loyalty settings: compute `current` from `$settings` collection.  
4. Re-bench store list query count (target **3–4** queries).

---

## Out of scope

- Changing loyalty formulas / tier thresholds  
- Enabling store delete  
- Shop rewards / redeem flows (linked from membership UI but separate pages)
