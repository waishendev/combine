# Activity Logs + Landing Page — Query Enhancement (2026-08-31)

Enhancement id: `activity-logs-landing-page-query-v1`

**CRM pages**
- `frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/activity-logs/page.tsx`
- `frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/landing-page/page.tsx` (reviewed; no code change — already healthy)

**Constraint:** List JSON keys / pagination / filter semantics unchanged. Facets still returned on page 1 (FE keeps them when omitted on later pages). Additive: `GET /activity-logs/{id}`, optional `include_filters`.

**Environment:** Local Postgres · activity_logs=8,875 · ecommerce_landing_pages=1 · median of 5 wall.

---

## Verdict

| Path | Before | After | Delta |
|------|--------|-------|-------|
| `GET /activity-logs` page 1 / 50 | ~23 ms / **4 q** | **~19 ms / 4 q** | Facets still on page 1 (expected) |
| `GET /activity-logs` page 2 / 50 | ~23 ms / **4 q** | **~12 ms / 2 q** | **−2 facet Seq Scans** |
| Date range month list SQL | Seq Scan **~3.6 ms** | Index range **~0.07 ms** | **~50× SQL** |
| `GET /ecommerce/landing-page` | ~1.1 ms / 1 q | unchanged | No change needed |

---

## What landed

### P0 — Sargable `created_at`
- Replaced `whereDate(created_at, …)` with half-open bounds (same calendar-day semantics as `PosAppointmentStartAtFilter`)
- Open-ended `date_from` / `date_to` still supported
- Applied on both `index` and `appointmentIndex`

### P0 — Slim list select
- Explicit columns; **omit `user_agent`** (was never in list JSON)
- Keeps `old_values` / `new_values` (table Changes column + detail modal need them)

### P1 — Facets only when needed
- `filters.model_types` / `filters.users` computed when `page <= 1` **or** `include_filters=1`
- Opt-out: `include_filters=0`
- FE already retains prior facet state when `filters` key is absent

### P1 — Indexes (`2026_08_31_000100_add_activity_logs_query_indexes.php`)
- `(action, created_at DESC)`
- `(action, model_type)`
- `(action, user_id)`

### Additive show
- `GET /api/activity-logs/{id}` — full row including `user_agent` (for future detail-by-id / deep link; list shape unchanged)

### Landing page
- No change (unique `slug`, ~1 ms)

---

## Not done (intentional)

| Item | Why |
|------|-----|
| Slim list without jsonb | FE Changes column + detail modal use list-row diffs; removing them changes UX |
| `pg_trgm` search indexes | Optional at larger volume; leading `%ILIKE` still OK at ~9k rows |

---

## Files

- `app/Http/Controllers/ActivityLogController.php`
- `database/migrations/2026_08_31_000100_add_activity_logs_query_indexes.php`
- `routes/api.php` — marked `NEW ENHANCEMENT — activity-logs-landing-page-query-v1`
- Review precursor: `Activity_Logs_Landing_Page_Query_Performance_Review_2026_08_31.md`

---

## Deploy

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate --force
```

Smoke: `/activity-logs` page 1 (dropdowns populate) → page 2 (filters still work) → date filter → open row detail.

---

## Bottom line

Activity logs: date filters use indexes again; page flips skip facet Seq Scans (4→2 queries). Landing page needed no work. Full jsonb list slim remains blocked by the Changes UI without a product/FE change.
