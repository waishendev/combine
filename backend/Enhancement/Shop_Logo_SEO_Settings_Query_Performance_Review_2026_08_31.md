# Shop Logo + SEO Settings — Query Performance Review (2026-08-31)

**Scope**
- CRM `/shop-logo` — two `LogoUploadForm` (shop logo + favicon) → `GET /api/ecommerce/branding`
- CRM `/seo-settings` — `SeoSettingsForm` → `GET /api/ecommerce/seo-global?type=ecommerce`
- CRM `/booking/seo-settings` — same form, `forcedWorkspace=booking` → `GET …/seo-global?type=booking`

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · settings=39 · `seo_global` rows=2 (unique `type`) · median of 5 wall.

**Related shipped work:** `crm-logo-thermal-branch-limit-query-v1` already added FE branding in-flight dedupe (`brandingFetch`) and `SettingService` request memo — `/shop-logo` benefits from the same `LogoUploadForm` path.

---

## Executive summary

| Call | Wall | Queries | Payload | Verdict |
|------|-----:|--------:|--------:|---------|
| `GET /ecommerce/branding?type=ecommerce` | **~2.0 ms** | 1 | ~1 KB | **OK** |
| `/shop-logo` page (2 forms) | **1× branding** (after v1) | 1 | — | Duplicate fixed by prior enhancement |
| `GET /seo-global?type=ecommerce` | **~2.3 ms** | 1 | ~1 KB | **OK** |
| `GET /seo-global?type=booking` | **~1.9 ms** | 1 | ~0.8 KB | **OK** |

**None of these three pages are query hotspots.** Each load is a single-row lookup by type (or settings type+key for branding). Indexes for the hot predicates already exist (`seo_global.type` UNIQUE, `settings(type,key)` UNIQUE). No N+1.

---

## Page → API map

### `/shop-logo`
| UI | API | Notes |
|----|-----|--------|
| Shop logo form | `GET /ecommerce/branding?type=…` | `shop_logo_url` |
| Favicon form | Same branding GET (shared in-flight) | `shop_favicon_url` |
| Upload | `POST /branding/shop-logo` / `shop-favicon` | File + settings update |

### `/seo-settings` (ecommerce)
| UI | API | Notes |
|----|-----|--------|
| Form load | `GET /ecommerce/seo-global?type=ecommerce` | `SeoGlobal` where `type` |
| Save | `PUT /ecommerce/seo-global?type=ecommerce` | updateOrCreate-by-type |
| OG image upload | `POST /ecommerce/seo-global/upload-image` | Storage write only |

### `/booking/seo-settings`
| UI | API | Notes |
|----|-----|--------|
| Form load | `GET /ecommerce/seo-global?type=booking` | Same controller, different `type` |
| Save / upload | Same paths with `type=booking` | Isolated booking row via UNIQUE(type) |

---

## Root causes & EXPLAIN

### 1. Shop logo — already addressed for duplicate fetch

Backend `BrandingController@show`:

```text
#01 select * from settings where type = ? and key = ? limit 1   ~0.35 ms
```

**EXPLAIN ANALYZE:**

```text
Limit → Seq Scan on settings (39 rows)
Filter: type='ecommerce' AND key='branding'
Execution Time: ~0.02 ms
```

`settings_type_key_unique` exists; Seq Scan is normal at this cardinality.

**Page-level:** Two forms previously issued two GETs; **`fetchEcommerceBranding` dedupe (already shipped)** collapses them to one. No further index work needed.

---

### 2. SEO settings — single-row by `type` (healthy)

`SeoGlobalController@show`:

```php
SeoGlobal::query()->where('type', $type)->first();
```

**Query log:** 1 query · ~0.4–0.5 ms SQL · ~2 ms wall.

**Indexes today:**

| Index | Definition |
|-------|------------|
| PK | `seo_global_pkey (id)` |
| UNIQUE | `seo_global_type_unique (type)` |

**EXPLAIN ANALYZE** (`WHERE type = 'ecommerce' LIMIT 1`):

```text
Limit  (actual time=0.017..0.017 rows=1)
  -> Seq Scan on seo_global  (actual time=0.014..0.015 rows=1)
        Filter: type = 'ecommerce'
        Buffers: shared hit=1
Execution Time: 0.029 ms
```

**EXPLAIN ANALYZE** (`WHERE type = 'booking' LIMIT 1`):

```text
Limit  (actual time=0.008..0.009 rows=1)
  -> Seq Scan on seo_global
        Filter: type = 'booking'
        Rows Removed by Filter: 1
Execution Time: 0.015 ms
```

With only 2 rows the planner prefers Seq Scan over the unique index — expected and still sub‑millisecond. At larger cardinality it would use `seo_global_type_unique`. At most one row per workspace by unique constraint — **cannot grow into an N+1 list problem**.

**Upload path:** `storeAs` on `public` disk — I/O bound, not SQL. Update is single-row UPDATE/INSERT by type.

**Recommendation:** None required for performance. Optional hygiene (not urgent):
- Explicit `select` of columns used by the form (omit nothing material today — table is narrow).
- Request-scoped memo for `SeoGlobal::where('type')` only if the same request loads SEO multiple times (not the case on these pages).

---

### 3. Missing indexes? — No

| Table | Predicate | Index |
|-------|-----------|--------|
| `settings` | `(type, key)` branding | `UNIQUE (type, key)` |
| `seo_global` | `type` | `UNIQUE (type)` |

No join graphs; no sorting of large sets; no pagination.

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk |
|----------|--------|---------|------|
| **—** | New indexes | None at current size | — |
| **—** | SEO controller rewrite | None | — |
| **Done already** | Branding FE dedupe + SettingService memo | Shop-logo 2→1 GET | Shipped in v1 |
| **P2 (optional)** | Confirm `seo_global_type_unique` on all envs | Avoid duplicate type rows | Ops check only |

If production still “feels slow,” look outside SQL: image upload size, CDN for OG/logo URLs, or Next.js page auth/`getTranslator` — not these list queries.

---

## Bottom line

`/shop-logo`, `/seo-settings`, and `/booking/seo-settings` are **single-row settings screens**. Local wall times are ~2 ms with 1 query each. The only historical waste on shop-logo (double branding GET) is already fixed by `crm-logo-thermal-branch-limit-query-v1`. **No production-safe query change is warranted** beyond verifying unique indexes exist in each environment.
