# CRM Booking Service Packages + Staff Schedules — Query Performance Review (2026-09-05)

**Scope**
- `frontend/.../booking/service-packages/page.tsx` → `ServicePackagesPage` + `ServicePackageFormModal`
- `frontend/.../booking/staff-schedules/page.tsx` → `StaffSchedulesTable` + Create/Edit/Delete/Bulk modals

**Constraint:** Analysis only — no business logic / API shape / UI / pagination / user-flow changes in this pass.

**Environment (local Postgres):** service_packages=2 · service_package_items=0 · booking_staff_schedules=28 · staffs=12 · booking_services=81 · median of 5 controller benches.

**Related prior work:** `booking-services-crm-query-v1` already added `GET /admin/booking/services/options` (used by package Create/Edit). Staff slim picker `GET /staffs/options/query` exists but **staff-schedules FE still uses heavy `/staffs`**.

---

## Executive summary

| Area | Local wall | Queries | Top risk |
|------|-----------:|--------:|----------|
| `GET /service-packages?per_page=50` | **~4.6 ms** / 3 q | Tiny catalog (2 pkgs, **0 items**) — wall hides structural waste |
| `GET /service-packages/{id}` (Edit) | ~3.7 ms / 3 q | Appropriate; Edit correctly uses **show** |
| `GET .../services/options?limit=2000` (Create/Edit) | **~18 ms** / 2 q | Already slim; FE drops most fields + filters eligibility client-side |
| `GET .../staff-schedules` (page) | **~26 ms** / 5 q | Fine at n=28; SQL ~0.03 ms |
| `GET .../staff-schedules/{id}` (Edit) | ~6 ms / 5 q | Appropriate |
| `GET /staffs?per_page=200` (table + modals) | **~22 ms** / 5 q | Heavy `index` (admin + storeLocations); **cap 50** despite FE asking 200 |
| `GET /staffs/options/query` (available, unused) | **~7 ms** / 3 q | id/name only — preferred for pickers |

**Priority themes**

1. **P0 packages (structural):** Drop `items.bookingService` from list `index` — table never renders items; Edit uses `show`. Scales with items×packages even when local n=0.
2. **P0 schedules (FE+API):** Replace `/staffs` with `/staffs/options/query`; stop double list fetch after `staffNameMap` changes; prefer eager `staff.name` from list (already loaded).
3. **P1 schedules:** Honor FE `day_of_week` + `per_page` (today ignored — filter/page-size appear broken / ineffective).
4. **P1 packages ACTION:** Optional `is_package_eligible=1` / `is_active=1` on services options to shrink Create/Edit payload.
5. **P2:** `service_packages(is_active)` if status filter lands; export/import remain full-dump by design.

---

## ACTION / navigation note

Both pages keep **on-page modals** (no `/[id]` edit routes). Still analyzed because Edit/Create hit APIs:

### Service packages `/booking/service-packages`

| Action | UI | APIs |
|--------|----|------|
| **Edit** | `ServicePackageFormModal` | `GET services/options?limit=2000` + **`GET /service-packages/{id}`** then PUT |
| **Create** | Same modal | options + `POST /service-packages` |
| **Delete** | Modal | `DELETE /{id}` (list row name only) |
| **Bulk** | — | Not implemented |
| **Import / Export** | Toolbar | Full dump / per-row import |
| Cross-link | Breadcrumb self only | No Edit→other page |

### Staff schedules `/booking/staff-schedules`

| Action | UI | APIs |
|--------|----|------|
| **Edit** | `StaffScheduleEditModal` | **`GET show/{id}`** (not list row) + PUT; own `/staffs` refetch |
| **Create** | Modal | `POST`; own `/staffs` refetch; branches from `BranchContext` |
| **Delete** | Modal | `DELETE` |
| **Toggle status** | In-row | `PUT {is_active}` (no show) |
| **Bulk** | Modal | `PUT .../bulk` then full list refetch |
| **Import / Export** | Toolbar | Full accessible dump / row-by-row |
| Cross-link | Unauthorized → `/dashboard` | No other page navigation |

---

## A) Service Packages list

### A1. List over-fetches items graph (P0 structural)

| # | Item | Detail |
|---|------|--------|
| 1 | Page | `/booking/service-packages` first paint / page / pageSize |
| 2 | Frontend | `ServicePackagesPage.fetchPackages` → `/api/proxy/service-packages?page&per_page` |
| 3 | API | `GET /service-packages` |
| 4 | Backend | `ServicePackageController@index` |
| 5 | Pattern | `with(['items.bookingService:id,name'])->orderByDesc('id')->paginate(...)` — no column select |
| 6 | Why slow (at scale) | Table uses only id, name, description, selling_price, valid_days, is_active. **Items unused on list.** Extra queries + JSON × (packages × items). Locally 0 items → ~4.6 ms hides the cost |
| 7 | Indexes | PK only on `service_packages`; items unique `(service_package_id, booking_service_id)` — fine for eager by package_id |
| 8 | EXPLAIN | `ORDER BY id DESC LIMIT 50` Seq Scan 2 rows · **~0.03 ms**. Items IN subquery · **~0.05 ms** (0 rows) |
| 9 | Recommendations | **P0:** Remove `items.bookingService` from list `with` (or empty `items: []` if key must stay). **Keep** on `show` / write responses. Lean `select` on package columns optional |
| 10 | Benefit | Same pattern as booking **services** / **products** list slim |
| 11 | Trade-off | Any consumer of list `items` must use show (CRM Edit already does) |
| 12 | Safe? | **Yes** for this CRM page |

**Bench:** list ~**4.6 ms** / 3 q · show ~**3.7 ms** / 3 q.

### A2. Create/Edit options (already good; small P1)

| # | Detail |
|---|--------|
| 2–3 | Modal always `GET /admin/booking/services/options?limit=2000` |
| 4–6 | Slim select + store ACL · ~**18 ms** / 2 q locally (81 services) |
| 9 | P1: pass `is_active` / package-eligible server-side; FE currently keeps `{id,name}` only after client filter |
| 12 | Edit correctly uses **show** for items — do not slim show items ids/qty/redemption |

### A3. Export / Import (P1/P2 by design)

| # | Detail |
|---|--------|
| 5 | export: `with('items')->get()` unbounded; import: per-row validate + transaction |
| 9 | Keep semantics; chunk/stream only if catalogs grow large |

---

## B) Staff Schedules list

### B1. List SQL healthy; FE amplifies cost (P0)

| # | Item | Detail |
|---|------|--------|
| 1–4 | `/booking/staff-schedules` | `GET /admin/booking/staff-schedules` |
| 5 | Pattern | `with(['staff:id,name','storeLocation:...'])->whereIn(store_location_id)->paginate(**50**)` |
| 6 | Issues | (a) FE sends `per_page` / `day_of_week` — **backend ignores both**. (b) FE maps staff name from separate `/staffs` map and **ignores eager `staff`**. (c) `fetchSchedules` deps include `staffNameMap` → **second list fetch** after staffs load |
| 7 | Indexes | `(staff_id, day_of_week)`, `(staff_id, day_of_week, is_active)`, `(store_location_id, start_time)`, overlap `(staff_id, day_of_week, start_time, end_time)` — good for ACL + overlap |
| 8 | EXPLAIN | Branch filter Seq Scan 28 · **~0.03 ms**. Overlap-style EXISTS · **~0.03 ms** |
| 9 | Recommendations | **P0 FE:** use `/staffs/options/query`; remove `staffNameMap` from list fetch deps (or use list `staff.name`). **P1 BE:** apply `day_of_week`; honor `per_page` (cap e.g. 200). Optional composite `(store_location_id, is_active)` as rows grow |
| 10 | Benefit | Cut duplicate list round-trip + ~3× cheaper staff picker (~22→~7 ms) |
| 12 | Safe? | Yes if response keys for schedule rows unchanged |

**Bench:** list ~**26 ms** / 5 q · show ~**6 ms** / 5 q.

### B2. Staff picker heavy `index` (P0)

| # | Detail |
|---|--------|
| 2 | Table mount + Create modal + Edit modal each hit `/staffs?per_page=200&is_active=true` |
| 4 | `StaffController@index` caps **50**, loads admin + storeLocations |
| 9 | Switch to existing **`/staffs/options/query`** (id/name, up to 500) — already used elsewhere in CRM |
| 11 | Trade-off: none for name dropdowns |

### B3. Edit ACTION (appropriate show; small double-fetch)

| # | Detail |
|---|--------|
| 2 | Edit sets `editingScheduleId` only → modal `GET show/{id}` |
| 6 | `loadSchedule` deps include `staffs` → **show may run twice** when staffs arrive |
| 9 | Keep show for consistency; drop staffs from show-reload deps; reuse table staff options |

### B4. Bulk / Export / Import (P1)

| # | Detail |
|---|--------|
| 5 | bulk: O(N) authorize + overlap `exists`; export: all accessible `->get()`; import: row-by-row |
| 9 | Expected cost; chunk export / batch overlap only if scale hurts |

---

## C) Indexes — gaps & recommendations

| Index | Why | Trade-off | Priority |
|-------|-----|-----------|----------|
| `service_packages (is_active)` or `(is_active, id)` | If FE adds status filter / `orderByDesc id` + active | Low | P2 (unused today) |
| `booking_staff_schedules (store_location_id, is_active)` | CRM branch + status filter | Low | P2 |
| Schedules existing overlap / staff_day indexes | Already cover Create/Edit overlap checks | — | OK |
| Package items unique | Already covers list/show item eager by package_id | — | OK |

No critical missing index for current local sizes; main wins are **stop unused eager loads** and **use slim staff options**.

---

## D) Sample SQL shape today

### Packages list
1. Count packages (+ optional is_active)  
2. Page packages `ORDER BY id DESC`  
3. `service_package_items` WHERE package_id IN (...)  
4. `booking_services` WHERE id IN (...) — **unused by table**

### Schedules list
1. ACL accessible stores  
2. Count + page schedules (`whereIn store_location_id`, optional staff/is_active)  
3. Eager staff  
4. Eager store_location  
(+ separate FE `/staffs` heavy index, often twice)

---

## E) Recommended implementation order (when approved)

1. **Packages P0:** Slim `ServicePackageController@index` — no items eager; keep on `show`.  
2. **Schedules P0:** FE → `/staffs/options/query`; use list `staff.name` or stable staff map without re-fetching schedules; dedupe Create/Edit staff fetch.  
3. **Schedules P1:** Backend honor `day_of_week` + `per_page` (behavior fix that also reduces over-fetch when day filter used).  
4. **Packages P1:** options query flags for eligible/active services.  
5. ANALYSIS + re-bench after ship.

**Do not change** Edit modal → separate page flow; keep show for Edit seed.

---

## Files referenced

**FE:** `ServicePackagesPage.tsx`, `ServicePackageFormModal.tsx`, `StaffSchedulesTable.tsx`, `StaffScheduleCreateModal.tsx`, `StaffScheduleEditModal.tsx`, `staffScheduleUtils.ts`  
**BE:** `ServicePackageController.php`, `StaffScheduleController.php`, `StaffController.php` (`index` vs `options`), `ServiceController::options`
