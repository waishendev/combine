# Activity Logs + Ecommerce Landing Page — Query Performance Review (2026-08-31)

**Scope**
- CRM `/activity-logs` — `ActivityLogTable` → `GET /api/activity-logs`
- CRM `/landing-page` — `EcommerceLandingPageEditor` → `GET|PUT /api/ecommerce/landing-page`

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · `activity_logs`=8,875 · `ecommerce_landing_pages`=1 · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries | Payload | Verdict |
|------|-----:|--------:|--------:|---------|
| `GET /activity-logs` ×50 (default) | **~23 ms** | 4 | ~25 KB | OK today; filter facets re-scan every page |
| `GET /activity-logs?action=updated` | **~23 ms** | 4 | ~22 KB | OK |
| `GET /activity-logs?search=a` | **~30 ms** | 4 | ~25 KB | OK; leading-wildcard `ILIKE` will hurt at scale |
| `GET /activity-logs` + month `date_from/to` | **~30 ms** | 4 | ~25 KB | **whereDate → Seq Scan** (non-sargable) |
| `GET /ecommerce/landing-page` (admin) | **~1.1 ms** | 1 | ~1.3 KB | **OK — not a hotspot** |
| `PUT /ecommerce/landing-page` | single upsert by `slug` | 1–few | — | OK |

**Main finding:** `/landing-page` is healthy. `/activity-logs` is acceptable at ~9k rows, but every list request pays for **two full-table DISTINCT facet queries**, ships **full `old_values`/`new_values` jsonb on every row**, and date filters use **`whereDate` (Seq Scan)**. Safe P0/P1 items below; no production breakage expected if applied carefully.

---

## Page → API map

### `/activity-logs`
| UI | API | Notes |
|----|-----|--------|
| List / page / filters | `GET /activity-logs` | `page`, `per_page` (1–200, default 50), `search`, `action`, `model_type`, `user_id`, `date_from`, `date_to` |
| Filter dropdowns | Same response `filters.model_types` + `filters.users` | Recomputed **on every list request** |
| Row detail modal | Client-only from list row | Needs `old_values` / `new_values` already in list payload |

### `/landing-page`
| UI | API | Notes |
|----|-----|--------|
| Editor load | `GET /ecommerce/landing-page` | `LandingPageController::adminShow` — `slug=home` |
| Save | `PUT /ecommerce/landing-page` | `updateOrCreate` by slug; JSON `sections` |

---

## Root causes & EXPLAIN

### 1. Activity logs — facet queries on every page (medium)

`ActivityLogController@index` always runs, in addition to COUNT + page:

```text
SELECT DISTINCT model_type … WHERE action IN (created,updated,deleted)
SELECT DISTINCT user_id, user_name … WHERE action IN (…) AND user_id IS NOT NULL
```

**Query log (default list):**

```text
#01 COUNT(*) … action IN (…)                         ~0.8 ms
#02 SELECT * … ORDER BY created_at DESC LIMIT 50     ~0.6 ms
#03 DISTINCT model_type                              ~3.2 ms  ← Seq Scan
#04 DISTINCT user_id, user_name                      ~3.2 ms  ← Seq Scan
```

**EXPLAIN ANALYZE (DISTINCT model_type):**

```text
Sort → HashAggregate → Seq Scan on activity_logs
Filter: action IN (created,updated,deleted)
Execution Time: ~3.0 ms · Buffers: shared hit=568
```

Same pattern for DISTINCT users (~2.9 ms, Seq Scan).

At 8.8k rows this is ~6 ms extra SQL per request. At 100k–1M rows these facets become the dominant cost and scale with table size, not page size.

**Recommendation (safe):**
- **P0:** Cache filter options for the request session / short TTL, **or** return facets only when `include_filters=1` / first page and let FE keep them (additive query flag; default can keep current shape).
- **P1:** Materialize distinct users/model_types via a small lookup table or periodic cache — only if volume grows.

---

### 2. Activity logs — `whereDate(created_at)` forces Seq Scan (medium at scale)

```php
$query->whereDate('created_at', '>=', $date_from);
$query->whereDate('created_at', '<=', $date_to);
```

**EXPLAIN ANALYZE (month range + LIMIT 50):**

```text
Limit → Sort → Seq Scan on activity_logs
Filter: action IN (…) AND date(created_at) >= … AND date(created_at) <= …
Execution Time: ~3.6 ms · Buffers: shared hit=568
```

Wrapping `created_at` in `date()` prevents use of `activity_logs_created_at_index`.

Default (no date) list plan is healthy:

```text
Limit → Index Scan Backward using activity_logs_created_at_index
Filter: action IN (…)
Execution Time: ~0.06 ms
```

**Recommendation (safe, same calendar-day semantics):** Replace with sargable bounds (same pattern as `PosAppointmentStartAtFilter`):  
`created_at >= startOfDay(from)` and `created_at < startOfNextDay(to)`.  
Trade-off: none if TZ/wall-clock storage matches existing `whereDate` tests (verify with equivalence tests).

---

### 3. Activity logs — list selects full jsonb + `user_agent` (low–medium)

List uses `SELECT *`, mapping includes `old_values` / `new_values`. Local avg JSON text length ≈ **172 + 468** chars/row; max pair ≈ **9.9 KB**. Default page payload ≈ **25 KB** for 50 rows.

FE table **and** detail modal both use these fields from the list row (no separate show endpoint). Slimming list columns would require either:
- keeping jsonb in list (status quo), or
- **additive** `GET /activity-logs/{id}` for detail and omitting jsonb from list (API/UX change — needs approval).

`user_agent` is selected but **not** returned in the mapped response — wasted I/O on wide rows (`width≈527` in EXPLAIN).

**Recommendation:**
- **P0 (shape-preserving):** Explicit column select omitting `user_agent` (and any unused columns).
- **P2 (needs product OK):** Detail-by-id + slim list without full jsonb.

---

### 4. Activity logs — leading-wildcard search (low today / high later)

```php
->where('model_label', 'ilike', "%{$search}%")
->orWhere('user_name', 'ilike', "%{$search}%")
```

Cannot use btree; will Seq Scan as volume grows. Local `search=a` ≈ **30 ms** wall.

**Recommendation:** Keep behavior; optional `pg_trgm` GIN later if search becomes hot. Trade-off: index storage + write overhead.

---

### 5. Activity logs — indexes present but composite gaps (low)

**Today:**

| Index | Present |
|-------|---------|
| PK `id` | yes |
| `(model_type, model_id)` | yes |
| `user_id` | yes |
| `action` | yes |
| `created_at` | yes |

Default list uses **created_at** index well; COUNT uses **action** index-only scan (~0.7 ms).

**Recommended additive indexes (safe):**

| Index | Why | Trade-off |
|-------|-----|-----------|
| `(action, created_at DESC)` | Aligns filter+sort; reduces filter-on-index-scan | +storage, slight write cost |
| `(action, model_type)` | Speeds model_type filter + facet DISTINCT | same |
| `(action, user_id)` | Speeds user filter | same |

Not urgent at 9k rows; valuable before 100k+.

---

### 6. Ecommerce landing page — healthy (no change needed)

- Unique index on `slug` already.
- Admin show: `WHERE slug = 'home'` → **1 query / ~1.1 ms / ~1.3 KB**.
- EXPLAIN on 1-row table: Seq Scan fine (unique index available when table grows).
- No N+1, no joins, no over-fetch beyond the single JSON `sections` document the editor needs.

**Public** `show()` adds `is_active = true` — still single-row by slug; optional composite `(slug, is_active)` only if many inactive rows appear (unlikely).

---

## Recommended plan (do not implement in this review)

| Priority | Change | Benefit | Risk to prod behavior |
|----------|--------|---------|------------------------|
| **P0** | Sargable `created_at` range instead of `whereDate` | Date filter Index Scan | Low (verify TZ equivalence) |
| **P0** | Select list columns without `user_agent` | Less I/O | None (already omitted from JSON) |
| **P1** | `(action, created_at DESC)` index | Faster default list/COUNT combo at scale | Low write overhead |
| **P1** | Facets only once / `include_filters` / short cache | Cut 2 Seq Scans per page flip | Low if response still includes filters when FE needs them |
| **P2** | Optional show-by-id + slim list jsonb | Much smaller list payloads | Medium — FE detail flow change |
| **P2** | `pg_trgm` for search | Search at scale | Index cost |
| **—** | Landing page | — | No action |

---

## Bottom line

- **`/landing-page`:** not a query performance problem.
- **`/activity-logs`:** fine locally (~23 ms / 4 q / 25 KB), but **facet DISTINCT + whereDate + wide jsonb rows** are the growth risks. Prefer sargable dates + lighter select + optional composite index before any API shape change.

---

## Reproduce

```bash
cd backend/ecommerce_gentlegurl_backend_api
# one-off bench used for this review (not committed):
# php storage/app/_bench_activity_landing_review.php
```
