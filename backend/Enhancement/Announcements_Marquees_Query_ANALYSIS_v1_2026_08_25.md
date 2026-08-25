# Announcements + Marquees — Query ANALYSIS (v1 apply) · 2026-08-25

**Enhancement tag:** `announcements-marquees-query-v1`  
**Constraint preserved:** same list/CRUD/move UX; list still returns `body_text` (truncated to 500 for table); marquee `text` filter now works.  
**Env:** Local Postgres · announcements=1 · marquees=0 · median of 5.

---

## Before → After

| Call | Before | After | Notes |
|------|-------:|------:|-------|
| `GET /announcements` ecom ×20 | ~7 ms / 2 q | **~10 ms / 2 q*** | Slim `LEFT(body_text,500)`; noise at 1 row |
| `GET /announcements/{id}` | ~2 ms | **~2 ms** | Full body on show/edit |
| `GET /marquees` ecom ×20 | ~4 ms / 2 q | **~7 ms / 2 q*** | Indexes; empty table |
| `GET /marquees` booking ×20 | ~4 ms | **~7 ms** | Same path `type=booking` |
| `PUBLIC /marquees` | **~7 ms / 6 q** | **~6 ms / 3 q** | Dropped `Schema::hasColumn` |
| move-up / move-down | POST + **full list refetch** | POST + **local row swap** | −1 list HTTP per move |

\*Tiny tables: wall noise dominates; EXPLAIN shows marquees now use the new indexes (Bitmap/Index Scan). Announcements still Seq Scan at 1 row (planner choice); indexes ready for growth.

---

## What shipped

### Indexes — `2026_08_25_001100_add_announcements_marquees_query_indexes.php`
- `announcements (type, sort_order, id DESC)`
- `announcements (type, is_active, sort_order)`
- `marquees (type, sort_order, id DESC)`
- `marquees (type, is_active, sort_order)`

### Backend
- Announcement list: explicit columns + `LEFT(body_text, 500)` (table truncate UI unchanged; show/edit still full)
- Marquee list: honor FE `text` filter (`LIKE %term%`)
- Public marquees: remove per-request `Schema::hasColumn` (always `orderBy sort_order`)

### Frontend
- `AnnouncementTable` / `MarqueeTable`: after successful move-up/down, **swap adjacent rows in state** (no list refetch)

### Routes
Tagged `// NEW ENHANCEMENT — announcements-marquees-query-v1`

---

## EXPLAIN (after)

**Marquees list `type=ecommerce`:** Bitmap Index Scan on `marquees_type_active_sort_idx`  
**Public marquees active:** Index Scan on `marquees_type_active_sort_idx`  
**Announcements list (1 row):** Seq Scan still chosen (table too small for index benefit)

---

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| Indexes | Slight write cost on create/update/move |
| `LEFT(body_text, 500)` on list | List preview max 500 chars (UI already truncates); Edit loads full via show |
| Marquee `text` LIKE | Leading `%` won’t use btree; OK for small CMS tables |
| Local move swap | If concurrent editors reorder, page may briefly diverge until next refresh |

---

## Bench artifact

`storage/app/_bench_announcements_marquees_review.php`
