# CRM Logo + Thermal Printer + Branch Limit — Query Enhancement (2026-08-31)

Enhancement id: `crm-logo-thermal-branch-limit-query-v1`

**CRM pages**
- `/crm-logo` (+ same pattern on `/shop-logo`, `/booking/shop-logo`)
- `/settings/thermal-printer`
- `/settings/branch-limit`

**Constraint:** No change to API response shapes, permissions, or upload/save flows.

**Environment:** Local Postgres · settings=39 · store_locations=2 · median of 5 where noted.

---

## Verdict

| Change | Result |
|--------|--------|
| FE branding in-flight dedupe | Logo + favicon forms share **1** `GET /branding` (was 2) |
| `SettingService::get` request memo | Same type+key within one request → **1 SQL** (verified 4 gets → 2 queries) |
| Platform-bypass `authorizeStoreLocation` | PK + name guard instead of ordered accessible list / `whereHas` |
| Landing indexes | Unchanged — already sufficient |

---

## What landed

### P0 — Shared branding fetch (FE)
- New `frontend/.../src/lib/brandingFetch.ts` — in-flight `Map` keyed by workspace type
- `LogoUploadForm` uses `fetchEcommerceBranding()` so concurrent mounts coalesce
- Helps `/crm-logo`, `/shop-logo`, `/booking/shop-logo` (each has two forms)

### P1 — Request-scoped `SettingService` memo
- `get()` stores resolved value on `request()->attributes`
- `set()` updates the same memo key
- Cleared automatically with the HTTP request (no Redis / static)

### P2 — Thermal authorize shortcut (platform bypass)
- `StoreLocationAccessService::authorizeStoreLocation`: if `hasPlatformBypass`, resolve via `whereKey` + `LOWER(name) <> 'all branches'` (+ optional `is_active`)
- Same 403 message / eligibility; non-bypass path unchanged

### Routes marked
`routes/api.php`: branding GET + branch-limit / thermal-printer block tagged  
`// NEW ENHANCEMENT — crm-logo-thermal-branch-limit-query-v1`

---

## Benchmark (local, after)

| Check | Result |
|-------|--------|
| `SettingService::get` branding×2 + branch_limit×2 | **2 queries** (expect 2 distinct keys) |
| Thermal show (platform bypass) | ~9 ms · queries: roles exists + location by id + pos row + optional legacy settings |
| Branch-limit show (superadmin) | ~6 ms · COUNT + settings (+ auth as applicable) |
| Branding single GET | Still ~2 ms / 1 q (unchanged; page-level 2→1 is FE) |

Thermal location lookup after bypass shortcut:

```text
select * from store_locations where id = ? and LOWER(name) <> ? limit 1
```

(no `exists(store_location_user)` on bypass path)

---

## Files

- `frontend/.../src/lib/brandingFetch.ts` (new)
- `frontend/.../src/components/LogoUploadForm.tsx`
- `app/Services/SettingService.php`
- `app/Services/StoreLocationAccessService.php`
- `routes/api.php`
- Review: `CRM_Logo_Thermal_BranchLimit_Query_Performance_Review_2026_08_31.md`

---

## Bottom line

Page mount for logo settings drops from **two identical branding GETs to one**. Backend settings reads are memoized per request, and platform super-admins authorize a branch with a lighter lookup. No new indexes; these pages were already small-row lookups.
