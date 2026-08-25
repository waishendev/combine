# Announcements + Marquee (Ecommerce / Booking) — Query Performance Review (2026-08-25)

**Scope**
- CRM `/announcements` — `AnnouncementTable` (`workspaceType=ecommerce`) + Create / Edit / Delete / move-up / move-down
- CRM `/marquee` — `MarqueeTable` (`workspaceType=ecommerce`) + Create / Edit / Delete / move-up / move-down
- CRM `/booking/marquee` — same `MarqueeTable` (`workspaceType=booking`) + same actions (shared `MarqueeController`, `type=booking`)

**Constraint:** Analysis only — no business logic / API / UX changes.  
**Environment:** Local Postgres · announcements=1 (ecommerce) · marquees=0 · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries* | Payload | Verdict |
|------|-----:|---------:|--------:|---------|
| `GET /ecommerce/announcements?type=ecommerce` ×20 | **~7 ms** | 2 | 1.3 KB | OK |
| `GET /ecommerce/announcements/{id}` show | **~2 ms** | 0–1 | 0.9 KB | OK |
| `GET /ecommerce/marquees?type=ecommerce` ×20 | **~4 ms** | 2 | 0.5 KB | OK (empty table) |
| `GET /ecommerce/marquees?type=booking` ×20 | **~4 ms** | 2 | 0.5 KB | OK (empty table) |
| Create / Update / Delete | single-row write (+ optional image FS) | 1–few | — | OK |
| move-up / move-down | 1 neighbor SELECT + 2 UPDATEs, then **FE re-lists** | — | — | OK DB; extra list round-trip |

\*Single instrumented list = **2 queries** (count + page). Multi-run median q inflated by listener stacking.

**These three CRM pages are not production hotspots at current cardinality.** Risk is **missing `(type, sort_order)` indexes** and wide announcement rows (`body_text`) when row counts grow. No N+1 (no relations).

---

## Page → API map

### `/announcements` (ecommerce)
| UI | API |
|----|-----|
| List / page | `GET /ecommerce/announcements?type=ecommerce` |
| Create | `POST /ecommerce/announcements?type=ecommerce` (+ optional `image_file`) |
| Edit open | `GET /ecommerce/announcements/{id}?type=ecommerce` |
| Edit save | `PUT …` |
| Delete | `DELETE …` |
| Move up/down | `POST …/move-up\|move-down` then **full list refetch** |

### `/marquee` (ecommerce) & `/booking/marquee` (booking)
| UI | API |
|----|-----|
| List / filter / page | `GET /ecommerce/marquees?type=ecommerce\|booking` (+ `is_active`) |
| Create / Edit / Delete / move | Same pattern as announcements |

Both marquee pages share one controller; only `type` differs. Booking page permissions are `booking.settings.*` on the Next page, while API middleware still expects `ecommerce.marquees.*` (auth concern, not query perf).

---

## Root causes & EXPLAIN

### 1. Indexes: PK only on both tables

Today:
```text
announcements → announcements_pkey
marquees      → marquees_pkey
```

No index on `type`, `sort_order`, `is_active`, or date windows.

**EXPLAIN** CRM list (`type = ecommerce ORDER BY sort_order, id DESC LIMIT 20`):
```text
Sort → Seq Scan on announcements (1 row) · Execution Time: 0.060 ms
  width ≈ 2556   -- body_text / image fields widen the row
```

**EXPLAIN** move neighbor (`type` + `sort_order < ? ORDER BY sort_order DESC LIMIT 1`):
```text
Sort → Seq Scan · 0.039 ms (1 row)
```

At 1 row this is fine. At hundreds of rows per type, every list / move / `max(sort_order)` on create becomes Seq Scan + Sort.

**Recommendation:**
- `announcements (type, sort_order, id DESC)`
- `announcements (type, is_active, sort_order)` — active filter + list
- `marquees (type, sort_order, id DESC)`
- `marquees (type, is_active, sort_order)`

Trade-off: small storage + slightly slower writes on create/update/move (acceptable for CMS tables).

### 2. Announcement list: `SELECT *` includes large `body_text`

EXPLAIN width **~2556**. List UI needs title, status, dates, sort, image thumbnail — not full body.

**Recommendation (P2):** Slim list `select()` omitting `body_text` (or truncate). Show/Edit keep full row. **Medium care** if any client reads body from list JSON (CRM list mapper likely does not need it — confirm before apply).

### 3. Move-up / move-down: correct SQL, then FE double-fetch

Backend (scoped by `type`):
1. Find previous/next by `sort_order`
2. Swap two rows in a transaction

Then FE always `fetch`es the full list again. Not an N+1, but **2 HTTP round-trips** per click.

**Recommendation:** Optional FE: swap rows in local state from move response metadata (`old_position` / `new_position`) and skip refresh when still on same page — UX-identical, fewer list queries. Zero API change.

### 4. Marquee FE sends `text` filter — backend ignores it

`MarqueeTable` sets `qs.set('text', …)` but `MarqueeController@index` has **no** `text` / `LIKE` filter. Filter UI is a no-op for search (functional gap, not a slow query). If text search is added later, need `LIKE` strategy or trigram index — out of scope for “safe index-only” apply.

### 5. Create / Edit / Delete — no query hotspots

- Create: `max(sort_order)` per type + insert (+ announcement image store)
- Edit: single UPDATE / show SELECT
- Delete: single DELETE (+ announcement image unlink)

No joins, no eager loads. Image work is filesystem, not SQL.

### 6. Adjacent: public shop endpoints (not these CRM pages)

`PublicMarqueeController` calls `Schema::hasColumn(..., 'sort_order')` every request → extra schema lookups (~6 q in bench for empty table). CRM admin does not hit this path. Optional cleanup when touching public marquees.

Public `current()` uses `(start_at IS NULL OR …) AND (end_at IS NULL OR …)` — hard to index perfectly; composite `(type, is_active, sort_order)` still helps the common prefix.

---

## Missing indexes (summary)

| Table | Today | Suggested | Why |
|-------|-------|-----------|-----|
| `announcements` | PK | `(type, sort_order, id DESC)` | CRM list + move neighbors |
| `announcements` | — | `(type, is_active, sort_order)` | Active filter / public |
| `marquees` | PK | `(type, sort_order, id DESC)` | Ecommerce + booking lists |
| `marquees` | — | `(type, is_active, sort_order)` | Active filter / public |

---

## Recommended safe optimizations (do not apply in this review)

| # | Change | Why | Trade-off | Behavior risk |
|---|--------|-----|-----------|---------------|
| **P1** | Indexes above on `announcements` + `marquees` | List / move / create max at scale | +storage, slight write cost | None |
| **P2** | Slim announcement list columns (omit `body_text`) | Less I/O / payload | Confirm FE list unused fields | Low–medium |
| **P2** | FE: local reorder after move-up/down | −1 list fetch per move | Must keep pagination totals | Low |
| **P3** | Implement or remove marquee `text` filter | Correctness / avoid confusion | If implementing LIKE, plan index | Medium if adding LIKE |
| **P3** | Public marquee: drop per-request `Schema::hasColumn` | −schema queries on shop | None | None |

**Already OK / skip:** N+1 (none); Create/Edit/Delete DB path; booking vs ecommerce share same thin queries.

---

## Suggested apply order (when approved)

1. Migration: `(type, sort_order, …)` indexes on both tables.  
2. Optional: slim announcement list select.  
3. Optional: FE local swap after move.  
4. Re-bench list + EXPLAIN (expect Index Scan when rows grow).

---

## Bench artifact

`backend/ecommerce_gentlegurl_backend_api/storage/app/_bench_announcements_marquees_review.php`
