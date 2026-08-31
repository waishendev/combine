# Landing Page + General Settings — Query Performance Review (2026-08-31)

**Scope**
- CRM `/landing-page` — `EcommerceLandingPageEditor` → `GET /api/ecommerce/landing-page`
- CRM `/booking/landing-page` — `BookingLandingPageEditor` → `GET /api/admin/booking/landing-page`
- CRM `/general-settings` — `ShopSettingsPageContent` + shipping/payment cards → shop-settings + fulfillment APIs
- CRM `/booking/general-settings` — `ShopSettingsPageContent` + many booking setting cards → repeated shop-settings index

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · settings=39 · ecommerce/booking landing=1 each · store_locations=2 · median of 5 wall.

**Related:** Ecommerce landing was already noted as healthy in `Activity_Logs_Landing_Page_Query_Performance_Review_2026_08_31.md`. This review adds booking landing + both general-settings pages.

---

## Executive summary

| Call / page | Wall | Queries | Verdict |
|-------------|-----:|--------:|---------|
| `GET /ecommerce/landing-page` (admin) | **~1.5 ms** | 1 | **OK** |
| `GET /admin/booking/landing-page` (admin) | **~2.2 ms** | 1 | **OK** (larger JSON ~16 KB) |
| `GET /shop-settings?type=ecommerce` | **~9.6 ms** | **12** | OK per call; key-by-key SELECTs |
| `GET /shop-settings?type=booking` | **~12.7 ms** | **18** | OK per call; key-by-key SELECTs |
| **`/booking/general-settings` (page)** | **~152 ms** | **~163** | **Hotspot — ~9× duplicate index GETs** |
| **`/general-settings` (page)** | **~19 ms** | **~26** | Mild — 2× index + fulfillment |

**Main finding:** Landing editors are single-row by `slug` and are fine. General Settings pages are slow because **many sibling cards each re-fetch the full `GET /shop-settings?type=…` payload**, multiplying HTTP + SQL. Indexes for `settings(type,key)` and landing `slug` already exist. No join/N+1 *inside* a single landing GET.

---

## Page → API map

### `/landing-page` / `/booking/landing-page`
| UI | API | Notes |
|----|-----|--------|
| Editor load | Ecommerce: `GET /ecommerce/landing-page` · Booking: `GET /admin/booking/landing-page` | `where('slug','home')` · UNIQUE(slug) |
| Save | `PUT` same paths | `updateOrCreate` by slug |
| Booking image upload | `POST …/upload-image` | Storage only |

### `/general-settings` (ecommerce)
| UI | API | Notes |
|----|-----|--------|
| `ShopSettingsPageContent` | `GET /ecommerce/shop-settings?type=ecommerce` | Full index (~12 SettingService::get) |
| `PaymentProofNotificationSettingsCard` | **Same index again** | Duplicate |
| `ShippingFulfillmentPriorityCard` | `GET …/shipping-fulfillment-priority` + `GET …/store-locations?per_page=100` | Separate |

### `/booking/general-settings`
| UI | Loads `GET …/shop-settings?type=booking`? |
|----|-------------------------------------------|
| `ShopSettingsPageContent` | Yes |
| `PosAvailabilityVerifyModeSettingsCard` | Yes |
| `BookingPolicySettingsCard` | Yes |
| `BookingMaxAdvanceDaysSettingsCard` | Yes |
| `BookingReminderEmailSettingsCard` | Yes |
| `BookingFeedbackEmailSettingsCard` | Yes |
| `PaymentProofNotificationSettingsCard` | Yes |
| `BookingDepositTermsSettingsCard` | Yes |
| `BookingSlotsHelpNoteSettingsCard` | Yes |
| `BookingServiceNoteSettingsCard` | **No** — single-key `…/booking_service_deposit_note` |

≈ **9 identical full-index GETs + 1 single-key show** on every page open.

---

## Root causes & EXPLAIN

### 1. Landing pages — single-row by slug (healthy)

**Ecommerce / booking adminShow:**

```text
SELECT * FROM {ecommerce|booking}_landing_pages WHERE slug = 'home' LIMIT 1
```

**Indexes:** `*_slug_unique (slug)` · PK(id).

**EXPLAIN ANALYZE (ecommerce):**

```text
Limit → Seq Scan on ecommerce_landing_pages (1 row)
Filter: slug = 'home'
Execution Time: 0.036 ms · Buffers: shared hit=1
```

**Booking:** Execution Time **0.017 ms** (same pattern).

Tiny tables → Seq Scan preferred; UNIQUE(slug) remains correct for scale. Booking response ~16 KB (gallery/artists URLs) vs ecommerce ~1.3 KB — payload size, not query count.

**Recommendation:** None for SQL. If editor feels slow, profile JSON size / image URL resolution (CPU), not indexes.

---

### 2. Shop-settings index — N point lookups per request (low per call / high when multiplied)

`ShopSettingController@index` calls `SettingService::get` once per key (ecommerce ≈12 keys, booking ≈18 keys). Each `get` is:

```sql
select * from settings where type = ? and key = ? limit 1
```

Request-scoped memo (already shipped) prevents *repeat* of the same key **within one HTTP request**, but does **not** collapse different keys, and does **not** share across parallel browser GETs.

**Bench (one booking index):** 18 queries · ~0.23–0.36 ms each · wall **~12.7 ms**.

**EXPLAIN ANALYZE (single key):**

```text
Limit → Seq Scan on settings (39 rows)
Filter: type='booking' AND key='booking_policy'
Execution Time: 0.019 ms
```

`settings_type_key_unique` exists; Seq Scan is normal at 39 rows.

**Batch alternative EXPLAIN** (`WHERE type = 'booking'`):

```text
Seq Scan on settings · Filter type='booking' · ~0.02 ms
```

One scan can hydrate all keys for a type — same response shape possible in PHP.

---

### 3. Booking general-settings — duplicate full-index fetches (primary hotspot)

Simulated page load (9× index + 1 show, separate request scopes):

| Metric | Measured |
|--------|----------|
| Wall | **~152 ms** |
| Queries | **~163** (≈ 9×18 + 1) |

Root cause is **frontend fan-out**, not missing indexes. Same pattern as historical `/crm-logo` double branding GET (fixed via `brandingFetch`).

**Recommendation (safe, shape-preserving):**
- **P0 FE:** Shared in-flight (and optional short TTL) fetch for `GET /api/ecommerce/shop-settings?type=…` — same approach as `fetchEcommerceBranding`. All cards await one Promise. Trade-off: none for API contract; cards must read fields from shared payload (BookingServiceNote can switch to index field `booking_service_deposit_note`).
- **P1 FE (optional):** React context from page parent — one fetch, props/context to cards. Slightly more refactor; still no API change.
- **P1 BE (optional):** In `index`, `Setting::where('type', $type)->get()->keyBy('key')` then map defaults — **1 query** instead of 12–18. Response JSON unchanged. Trade-off: tiny write-path unchanged; slightly more memory for unused keys of that type (negligible).

---

### 4. Ecommerce general-settings — mild duplicate + side fetches

| Call | Wall | Queries |
|------|-----:|--------:|
| 2× shop-settings index + fulfillment show | **~19 ms** | **~26** |
| shipping-fulfillment alone | **~0.8 ms** | 1 |

`PaymentProofNotificationSettingsCard` re-fetches full ecommerce index. Shipping card also loads store-locations list (branch picker) — separate concern; with 2 locations not a DB hotspot.

**Recommendation:** Same P0 shared shop-settings fetch (covers ecommerce + booking). Leave fulfillment/store-locations as-is unless store_locations grows large.

---

### 5. Missing indexes? — No

| Table | Predicate | Index |
|-------|-----------|--------|
| `ecommerce_landing_pages` | `slug` | UNIQUE |
| `booking_landing_pages` | `slug` | UNIQUE |
| `settings` | `(type, key)` | UNIQUE |
| `store_locations` | PK + feature indexes | present |

No inefficient joins on these paths. No list sorting over large tables.

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk |
|----------|--------|---------|------|
| **P0** | FE in-flight dedupe for shop-settings index by `type` | Booking page ~9 GETs → 1 (~152 ms → ~13 ms class) | Low — mirror brandingFetch |
| **P1** | BE batch `settings` by `type` in `ShopSettingController::index` | 12–18 q → 1 per index call | Low — same JSON |
| **P2** | Align `BookingServiceNoteSettingsCard` to shared index | Drop extra show GET | Low |
| **—** | New DB indexes | Not needed | — |
| **—** | Landing page query rewrite | Not needed | — |

---

## Bottom line

`/landing-page` and `/booking/landing-page` are **not** query bottlenecks. `/booking/general-settings` is: **many cards independently reload the same shop-settings index**, turning an ~13 ms / 18-query call into ~150 ms / 160+ queries. `/general-settings` has a milder 2× duplicate. Prefer a **shared FE fetch** (and optionally a **batched BE index**) — both preserve production API behavior.
