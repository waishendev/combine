# Home Sliders — Query ANALYSIS (v1 apply) · 2026-08-25

**Enhancement tag:** `home-sliders-query-v1`  
**Constraint preserved:** same list/CRUD/move UX; `image_url` / `mobile_image_url` still present; list columns cover CRM mapper fields.  
**Env:** Local Postgres · 8 home_sliders (4 ecommerce + 4 booking) · median of 5.

---

## Before → After

| Call | Before | After | Δ |
|------|-------:|------:|--:|
| `GET /home-sliders` ecom ×20 | **12.2 ms** wall / 4.3 sql | **10.7 ms** / 4.9 sql | wall ↓ |
| `GET /home-sliders` booking ×20 | **15.6 ms** / 4.9 sql | **11.1 ms** / 5.8 sql | **~29% wall** |
| `GET /home-sliders/{id}` | ~2.0 ms | **~1.1 ms** | no exists() |
| `PUBLIC /sliders` ecom | **8.4 ms** | **5.5 ms** | **~35%** |
| move-up / move-down | POST + **list refetch** (booking dropped `type`) | POST + **local swap** | −1 list; booking fixed |

List still **2 queries** (count + page). Slim select confirmed in query log.

---

## What shipped

### Model
- `HomeSlider` URL appends use `Storage::url()` only — **no `Storage::exists()`**

### Backend
- Admin list `select([...])` explicit columns (same shape FE needs)
- Migration `2026_08_25_001200_add_home_sliders_query_indexes.php`:
  - `(type, sort_order, id)`
  - `(type, is_active, sort_order)`

### Frontend
- `SliderTable` move-up/down: adjacent row swap in state (no refetch; avoids booking `type` default bug)

### Routes
Tagged `// NEW ENHANCEMENT — home-sliders-query-v1`

---

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| No `exists()` | Missing files return a URL instead of null — browser 404; same pattern as other CMS assets |
| Indexes | Slight write cost on create/update/move |
| Local move swap | Concurrent editors may diverge until next refresh |
| Slim list select | Already includes all list/mapper fields; show/edit unchanged |

---

## Bench artifact

`storage/app/_bench_home_sliders_review.php`
