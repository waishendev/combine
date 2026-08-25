# Home Slides (Ecommerce / Booking) — Query Performance Review (2026-08-25)

**Scope**
- CRM `/slides` — `SliderTable` (`sliderType=ecommerce`) + Create / Edit / Delete / move-up / move-down
- CRM `/booking/slides` — same table (`sliderType=booking`) + same actions  
  Shared API: `HomeSliderController` (`/ecommerce/home-sliders?type=…`)

**Constraint:** Analysis only — no business logic / API / UX changes.  
**Environment:** Local Postgres · home_sliders=8 (ecommerce=4, booking=4) · median of 5 wall.

---

## Executive summary

| Call | Wall | SQL | Queries* | Payload | Verdict |
|------|-----:|----:|---------:|--------:|---------|
| `GET /home-sliders?type=ecommerce` ×20 | **~12 ms** | ~4 ms | 2 | 3.0 KB | OK SQL; wall > SQL |
| `GET /home-sliders?type=booking` ×20 | **~16 ms** | ~5 ms | 2 | 3.0 KB | Same path |
| `GET /home-sliders/{id}` show | **~2–3 ms** | ~0** | 0–1 | 0.7 KB | OK |
| Create / Update / Delete | single-row + image FS | — | 1–few | — | OK |
| move-up / move-down | neighbor + 2 UPDATEs, then **FE re-lists** | — | — | — | Extra list round-trip |
| `GET /public/sliders` (shop) | ~8–9 ms | ~3 ms | 1–3 | ~1.9 KB | Adjacent; already slim select |

\*Single list log = **2 queries** (count + page).  
\*\*Show bench used an already-loaded model (route binding normally +1 SELECT).

**Not a DB hotspot at 8 rows.** The gap **wall (~12–16 ms) ≫ SQL (~4–5 ms)** comes from `HomeSlider` accessors calling **`Storage::exists()` twice per row** when serializing `image_url` / `mobile_image_url`. Indexes for `(type, sort_order)` are incomplete (only bare `type` today).

---

## Page → API map

| UI | API |
|----|-----|
| List / page | `GET /ecommerce/home-sliders?type=ecommerce\|booking` |
| Create | `POST /ecommerce/home-sliders` (+ desktop/mobile image files) |
| Edit open | `GET /ecommerce/home-sliders/{id}` |
| Edit save | `PUT …` |
| Delete | `DELETE …` |
| Move up/down | `POST …/move-up\|move-down` then **full list refetch** |

Both CRM pages share one controller; only `type` differs. No joins / no Eloquent relations → **no SQL N+1**.

---

## Root causes & EXPLAIN

### 1. Serialization cost: `Storage::exists` in URL appends (main wall gap)

```php
// HomeSlider::$appends = ['image_url', 'mobile_image_url']
Storage::disk('public')->exists($normalizedPath); // per append, per row
```

List of 4 ecommerce slides → up to **8 filesystem exists checks** on every list response. SQL is ~4 ms; wall ~12 ms.

**Recommendation (P1 / safe if URL shape unchanged):** Build URL from path without `exists()` (same as Announcement `image_url`: `Storage::url` / `url('storage/…')`). Missing files still return a URL; 404 is handled by the browser. Trade-off: broken paths no longer “null out” via exists — confirm FE/shop tolerate that (they already use returned URLs).

### 2. Indexes: only `type`, not sort composite

Today:
```text
home_sliders_pkey
home_sliders_type_index  -- btree (type)
```

**EXPLAIN** CRM list (`type = ecommerce ORDER BY sort_order, id LIMIT 20`):
```text
Sort → Seq Scan on home_sliders (8 rows total, 4 match)
  width ≈ 5939
  Execution Time: 0.075 ms
```

Planner ignores the `type` index at this size. At growth, want covering sort:

**Recommendation:**
- `(type, sort_order, id)` — list + move neighbors + `max(sort_order)` on create  
- `(type, is_active, sort_order)` — active filter + public shop  

Trade-off: small storage + slight write cost on create/update/move.

### 3. Move-up / move-down: FE re-fetches list (and omits `type`)

After successful move, FE refetches:

```text
GET /home-sliders?page=&per_page=   // no type=
```

Controller defaults `type` to **`ecommerce`**. On **`/booking/slides`**, a move refresh can briefly reload **ecommerce** rows (functional footgun when applying FE fix — local swap also fixes this).

Backend move itself: scoped by `$slider->type`, neighbor SELECT + swap — fine; needs `(type, sort_order)` for scale.

**Recommendation:** Local adjacent swap after move (same as marquees APPLY) — −1 list HTTP; keeps booking type correct.

### 4. Wide `SELECT *` on admin list

EXPLAIN width **~5939**. List needs thumbnails + title/subtitle/status/dates/sort — not every content layout field is critical, but payload is still small (~3 KB @ 4 rows). Slimming is optional **P2**; image append cost matters more.

Public shop already selects a column subset (good).

### 5. Create / Edit / Delete — OK

- Create: `max(sort_order)` per type + insert + file store  
- Edit/Delete: single row + optional FS delete  
No inefficient joins.

---

## Missing / recommended indexes

| Today | Suggested | Why |
|-------|-----------|-----|
| PK + `(type)` | `(type, sort_order, id)` | List / move / create max |
| — | `(type, is_active, sort_order)` | Active + public window queries |

---

## Recommended safe optimizations (do not apply in this review)

| # | Change | Why | Trade-off | Behavior risk |
|---|--------|-----|-----------|---------------|
| **P1** | Stop `Storage::exists` in `image_url` / `mobile_image_url` | Cuts wall ≫ SQL gap on every list/show/public | Broken files may return URL instead of null | Low if clients already use URL |
| **P1** | Indexes `(type, sort_order, id)` + `(type, is_active, sort_order)` | Scale list/move/public | +storage, slight writes | None |
| **P2** | FE local swap after move (+ pass `type` if refetch kept) | −1 list fetch; fixes booking refresh bug | Concurrent edit drift | Low |
| **P3** | Slim admin list select (match public columns + dates/flags) | Less I/O at large text/layout growth | Confirm FE fields | Low–medium |

**Already OK / skip:** SQL N+1 (none); public slim select; Create/Edit/Delete DB shape.

---

## Suggested apply order (when approved)

1. Accessor URL without `exists()` (biggest easy win).  
2. Migration for composite indexes.  
3. FE local move swap (and/or add `type` to refresh qs).  
4. Re-bench list wall vs sql.

---

## Bench artifact

`backend/ecommerce_gentlegurl_backend_api/storage/app/_bench_home_sliders_review.php`
