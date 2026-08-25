# Membership / Loyalty / Store — Query ANALYSIS (v1 apply) · 2026-08-25

**Enhancement tag:** `membership-loyalty-store-query-v1`  
**Constraint preserved:** same CRUD / form flows; list still returns `images` array (0–1 cover); `branch_usage` shape unchanged; loyalty `{ current, history }` unchanged.  
**Env:** Local Postgres · 3 tiers · 1 loyalty setting · 2 stores · 2 images · median of 5.

---

## Before → After (median wall)

| Call | Before | After | Notes |
|------|-------:|------:|-------|
| `GET /public/shop/membership/tiers` | ~3 ms / 3 q | **3.0 ms / 3 q** | Indexes ready for growth |
| `GET /ecommerce/loyalty-settings` | **~6 ms / 6 q** | **3.6 ms / 3 q** | Derived `current` (−1 SELECT) |
| `GET /ecommerce/membership-tiers` ×50 | ~6 ms / 6 q | **5.8 ms / 6 q** | Sort indexes added |
| `GET /ecommerce/store-locations` ×50 | **~13 ms / 5 q*** | **10.1 ms / 4 q*** | No duplicate COUNT; cover-only |
| `GET /ecommerce/store-locations/{id}` | ~6 ms / 3 q | **3.8 ms / 3 q** | Full images on show/edit |

\*Single instrumented list call (multi-run listener stacking inflates median q).

---

## What shipped

### Store list (`StoreLocationController@index`)
- Reuse paginator `total()` for `branch_usage.count` when **no filters** (avoids 2nd `COUNT(*)`)
- Filtered lists still call unfiltered `usage()` so capacity stays correct
- Cover-only images via Postgres `DISTINCT ON (store_location_id)` — `images` array still present (length 0–1); list FE only uses first thumbnail; Create/Edit/Detail still load full `images` via show

### Loyalty settings
- `current` resolved from already-loaded `history` collection (same effective-date rule as `getActiveSetting()`)

### Indexes — migration `2026_08_25_001000_add_membership_loyalty_store_query_indexes.php`
- `store_locations (sort_order, name)`
- `store_location_images (store_location_id, sort_order, id)`
- `loyalty_settings (rules_effective_at DESC NULLS LAST, created_at DESC)`
- `membership_tier_rules (is_active, min_spent_last_x_months, sort_order)`
- `membership_tier_rules (sort_order)` — CRM move-up/down neighbors

### Routes
Tagged `// NEW ENHANCEMENT — membership-loyalty-store-query-v1` on store-locations, loyalty-settings, membership-tiers, public membership/tiers.

---

## Query log: store list ×15 (after)

```text
#01 count(*) store_locations          -- paginator only (shared with branch_usage)
#02 select * store_locations … limit
#03 DISTINCT ON cover images
#04 settings branch_limit
```

**Before:** same + **extra** `count(*)` from `BranchCapacityService::usage()`.

---

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| Indexes | Slight write cost / storage on create/update |
| List covers only | List `images.length` may be 1 even if branch has more; Edit/Detail still full via show |
| Loyalty derive current | Identical rule; must keep collection order (`effective_at DESC, created_at DESC`) |

---

## Bench artifact

`storage/app/_bench_loyalty_store_review.php`
