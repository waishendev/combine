# CRM Booking Service Packages + Staff Schedules — Query Enhancement ANALYSIS v1 (2026-09-05)

Enhancement id: `booking-packages-schedules-crm-query-v1`

**CRM pages**
- `/booking/service-packages` (`ServicePackagesPage` + Create/Edit form modal)
- `/booking/staff-schedules` (`StaffSchedulesTable` + Create/Edit/Delete/Bulk modals)

**Review:** `Booking_Service_Packages_Staff_Schedules_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / ACTION navigation changes. Packages list keeps `items: []`. Full items still on `show` / write / export. Schedules Edit still uses `show`.

**Environment:** Local Postgres · service_packages=2 · items=0 · schedules=28 · staffs=12 · booking_services=81 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| **Packages list** `per_page=50` | ~4.6 ms / **3 q** | **~3.8 ms / 2 q** | Dropped `items.bookingService` eager (structural win as items grow) |
| `GET packages/{id}` (Edit) | ~3.7 ms / 3 q | **~3.9 ms / 3 q** | Unchanged full items |
| **Services options** (package modal) | ~18 ms / all services | **~21 ms / 79 eligible** | Server `is_active` + `is_package_eligible` |
| **Schedules list** | ~26 ms / 5 q | **~30 ms / 5 q** | Stable; FE no longer double-fetches after staff map |
| Schedules + `day_of_week=1` | ignored (all days) | **~12 ms / 5 q · 4 rows** | Filter applied |
| `GET /staffs` (heavy, was used) | ~22 ms / 5 q | — | Replaced |
| **`/staffs/options/query`** | unused | **~9 ms / 3 q** | Table + Create/Edit pickers |

ACTION UX unchanged: Edit / Create / Delete / Bulk stay on-page modals.

---

## What was wrong

1. **Packages list** hydrated `items.bookingService` though the table never renders items; Edit already called `show`.
2. **Staff schedules** used heavy `GET /staffs` (admin + storeLocations, cap 50) three times (table + Create + Edit), ignored eager `staff.name`, and re-fetched the list whenever `staffNameMap` changed.
3. Backend ignored FE `day_of_week` and hardcoded `paginate(50)` despite FE `per_page`.

---

## What landed

### Backend — service packages
- `ServicePackageController@index`: lean `select`; **no** items eager; `items: []` on each row.
- `show` / store / update / export still load items (+ bookingService on show/write).

### Backend — services options (package Create/Edit)
- Optional `is_package_eligible` filter (additive query param).
- Form modal calls `?limit=2000&is_active=true&is_package_eligible=1`.

### Backend — staff schedules
- Honor `per_page` (1–200, default 50).
- Honor `day_of_week` (0–6).
- Explicit `orderBy('id')`.

### Frontend — staff schedules
- Table staff dropdown → `/staffs/options/query?per_page=200&is_active=true`.
- List mapping prefers eager `staff.name` (no remount fetch on staff map).
- Create/Edit receive `staffs` from table (no duplicate fetch when parent has data); fallback still options endpoint.
- Edit `show` deps = `[scheduleId]` only (no double show when staffs arrive).

### Routes / permissions
- Tagged `booking-packages-schedules-crm-query-v1` on packages index + staff-schedules apiResource.
- `/staffs/options/query` permissions include `booking.schedules.create|update`.

---

## ACTION map

| Action | UI | Change |
|--------|----|--------|
| Packages Edit | Modal + `GET show` | Same; options filtered server-side |
| Packages Create | Modal | Same; options filtered |
| Schedules Edit | Modal + `GET show` | Same show; staff from parent options |
| Schedules Create | Modal | Staff from parent options |
| Schedules day filter | Filters modal | Now applied server-side |
| Schedules page size | Pagination | Now honored by backend (≤200) |
| Import / Export / Bulk | Toolbar / modal | Unchanged full-dump / O(N) paths |

No separate Edit page routes.

---

## Residual / P2

- Local packages catalog tiny (0 items) — re-measure when items grow; list query count already −1.
- Export/import still unbounded / row-by-row by design.
- Optional `(store_location_id, is_active)` on schedules if branch+status lists get large.
- Packages `is_active` index only if FE adds status filter.

---

## Files touched

**BE:** `ServicePackageController.php`, `ServiceController.php` (options flag), `StaffScheduleController.php`, `routes/api.php`  
**FE:** `ServicePackageFormModal.tsx`, `StaffSchedulesTable.tsx`, `StaffScheduleCreateModal.tsx`, `StaffScheduleEditModal.tsx`, `staffScheduleUtils.ts`
