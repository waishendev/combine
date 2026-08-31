# CRM Logo + Thermal Printer + Branch Limit — Query Performance Review (2026-08-31)

**Scope**
- CRM `/crm-logo` — two `LogoUploadForm` (CRM logo + favicon) → `GET /api/ecommerce/branding`
- CRM `/settings/thermal-printer` — `ThermalPrinterSettingsForm` → `GET /api/ecommerce/thermal-printer-settings?store_location_id=`
- CRM `/settings/branch-limit` — `BranchLimitSettings` → `GET /api/ecommerce/branch-limit`

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · settings=39 · store_locations=2 · store_location_pos_settings=1 · median of 5 wall (branch-limit: superadmin user).

---

## Executive summary

| Call | Wall | Queries | Payload | Verdict |
|------|-----:|--------:|--------:|---------|
| `GET /ecommerce/branding?type=ecommerce` | **~2.3 ms** | 1 | ~1 KB | **OK** |
| CRM logo **page** (2 forms) | **~2× branding** | 2 | 2× | Duplicate client fetch |
| `GET /thermal-printer-settings?store_location_id=` | **~7 ms** | 3 | ~0.3 KB | **OK**; auth + row + optional legacy settings |
| `GET /branch-limit` (superadmin) | **~1–40 ms*** | 2 | ~80 B | **OK** — COUNT + settings key |
| Landing-style single-row settings | — | — | — | Indexes already present |

\*First cold call can look high (~40 ms); EXPLAIN on `COUNT(*)` / settings lookup is **&lt;0.1 ms**. Not a DB hotspot.

**None of these three pages are production query hotspots at current cardinality.** Safe improvements are mostly **avoiding duplicate branding GETs** on `/crm-logo` and optional **request-scoped SettingService memo** (shared with many other settings pages).

---

## Page → API map

### `/crm-logo`
| UI | API | Notes |
|----|-----|--------|
| CRM Logo form mount | `GET /ecommerce/branding?type=…` | Reads `crm_logo_url` |
| Favicon form mount | **Same** `GET /ecommerce/branding?type=…` | Reads `crm_favicon_url` — **second identical call** |
| Upload logo | `POST /ecommerce/branding/crm-logo` | File write + `SettingService::set` |
| Upload favicon | `POST /ecommerce/branding/crm-favicon` | Same |

### `/settings/thermal-printer`
| UI | API | Notes |
|----|-----|--------|
| Form load (per selected branch) | `GET /ecommerce/thermal-printer-settings?store_location_id=` | Authorize branch → `store_location_pos_settings` → optional legacy `settings.thermal_printer` |
| Save | `PUT …/thermal-printer-settings` | `updateOrCreate` by `store_location_id` |
| Test | Client socket / optional `POST …/test` | Network I/O, not SQL |

### `/settings/branch-limit`
| UI | API | Notes |
|----|-----|--------|
| Load | `GET /ecommerce/branch-limit` | Superadmin only → `StoreLocation::count()` + `settings.branch_limit` |
| Save | `PUT /ecommerce/branch-limit` | `Setting::updateOrCreate` then `usage()` again |

---

## Root causes & EXPLAIN

### 1. CRM logo page — duplicate branding fetch (low severity, clear waste)

Each `LogoUploadForm` independently calls:

```text
GET /api/proxy/ecommerce/branding?type={workspace}
```

Backend `BrandingController@show` is cheap (1 settings row), but the **page pays twice** for the same JSON.

**Query log (single branding show):**

```text
#01 select * from settings where type = ? and key = ? limit 1   ~1 ms
```

**EXPLAIN ANALYZE:**

```text
Limit → Seq Scan on settings (39 rows)
Filter: type='ecommerce' AND key='branding'
Execution Time: ~0.05 ms
```

Unique index `settings_type_key_unique (type, key)` exists; at 39 rows Postgres prefers Seq Scan (normal).

**Recommendation (safe, FE-only):**
- Lift one shared branding fetch to the page (or small context/hook) and pass URLs into both forms.
- Trade-off: none for API contract; reduces page mount from 2 GETs → 1.

Optional backend: request-scoped memo in `SettingService::get` (helps this and many other pages). Low risk if cleared per request.

---

### 2. Thermal printer — healthy path; cost is auth + 1–2 lookups (OK)

**Query log (non–platform-bypass user, no pos row → legacy fallback):**

```text
#01 store_locations + exists(store_location_user)   ~authorize
#02 store_location_pos_settings WHERE store_location_id = ? 
#03 settings WHERE type/key = thermal_printer         -- legacy only when #02 empty
```

**Indexes today:**
- `store_location_pos_settings (store_location_id)` **UNIQUE** — Index Scan (~0.04 ms)
- `settings (type, key)` UNIQUE
- `store_locations` PK + several partial list indexes

**EXPLAIN authorize (exists join):** Execution ~0.17 ms locally — fine.  
**EXPLAIN PK-style branch filter:** ~0.12 ms.

When a pos-settings row exists, `#03` is skipped (`settings()` short-circuits). Local branch without a row hits legacy settings — by design.

**Recommendation:**
- **No new index required.**
- Micro (optional): for platform-bypass users, resolve branch via `StoreLocation::query()->find($id)` (+ name guard) instead of ordered accessible list — tiny win, behavior-sensitive; only if profiling shows authorize dominating.
- Ensure FE always sends `store_location_id` (already required) — avoids validation failures, not SQL cost.

---

### 3. Branch limit — two tiny queries (OK)

**Success path (superadmin):**

```text
#01 SELECT count(*) FROM store_locations
#02 SELECT * FROM settings WHERE type='ecommerce' AND key='branch_limit'
```

**EXPLAIN COUNT:** Seq Scan on 2 rows · **~0.08 ms**  
**EXPLAIN settings:** Seq Scan · **~0.03 ms**

At current branch counts, indexing `COUNT(*)` is pointless. Even at hundreds of branches, a plain COUNT remains cheap vs app auth.

**Recommendation:** None for SQL. Optional: cache `limit` in request memo via `SettingService` (same as branding). Do **not** cache `count` across requests without invalidation on branch create/delete.

---

## Index inventory (already adequate)

| Table | Relevant index | Status |
|-------|----------------|--------|
| `settings` | `UNIQUE (type, key)` | Present |
| `store_location_pos_settings` | `UNIQUE (store_location_id)` | Present |
| `store_locations` | PK + list partial indexes | Present |

No missing index is blocking these three pages.

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk to prod behavior |
|----------|--------|---------|------------------------|
| **P0** | FE: single shared branding fetch on `/crm-logo` | 2 → 1 GET on page load | None |
| **P1** | Request-scoped memo in `SettingService::get` | Dedupes branding / branch_limit / thermal legacy / many settings pages | Low (per-request only) |
| **P2** | Thermal authorize shortcut for platform bypass | Micro CPU/SQL | Low–medium (must keep same 403 rules) |
| **—** | New DB indexes for these pages | — | Not needed now |

---

## Bottom line

These settings pages are **not slow because of missing indexes or N+1 list queries**. They are single-row / count lookups with good uniques already. The only clear waste on the reviewed surfaces is **`/crm-logo` loading branding twice** (one per form). Thermal and branch-limit are already in good shape.

---

## Reproduce

```bash
cd backend/ecommerce_gentlegurl_backend_api
# one-off benches used for this review (not committed)
```
