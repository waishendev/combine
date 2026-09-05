# CRM Booking Services — Query Enhancement ANALYSIS v1 (2026-09-05)

Enhancement id: `booking-services-crm-query-v1`

**CRM page:** `/booking/services` (`BookingServicesTable` + Edit / Create / Bulk / Allowed-staff modals)

**Review:** `Booking_Services_CRM_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / checkout / ACTION navigation changes. List keeps response keys (`questions` / `primary_slots` empty arrays on list). Full graph still on `show` / write responses.

**Environment:** Local Postgres · booking_services=81 · question_options=956 · categories=7 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| Services list `per_page=50` | **~880 ms** / 12 q | **~294–343 ms** / **8 q** | Drop questions/options/slots eager + list format |
| Services list + branch | ~1028 ms / 13 q | **~294 ms** / 9 q | Same slim path |
| Edit/Create picker (was paged full list) | ~1× list cost (≥880 ms) | **`/services/options` ~19 ms / 3 q** | Slim select only |
| `categories?all=1` | ~79 ms / 12 q | **~12 ms / 4 q** | No services.storeLocations; batch linked product cats |
| `GET services/{id}` (Edit seed) | ~23 ms / 7 q | **~20 ms / 7 q** | Unchanged full graph |

ACTION UX unchanged: Edit / Create / Allowed staff / Delete stay on-page modals.

---

## What landed

### Backend — list slim
- `ServiceController@index` eager: `allowedStaffs`, `storeLocations`, `categories`, `linkedBookingProduct` only.
- `formatService(..., forList: true)` returns empty `questions` / `primary_slots` (keys preserved).
- `show` / create / update still use full `formatService` with questions + slots.

### Backend — options endpoint (additive)
- `GET /admin/booking/services/options?limit=2000` → `{id,name,cn_name,duration_min,service_price,is_active,is_package_eligible}` + branch ACL.
- Permissions: `booking.services.view|create|update`.

### Backend — categories `all=1`
- Skip `services.storeLocations` eager; `store_locations: []` on dropdown payload.
- `preloadLinkedProductCategories` removes N+1 `find` per category.

### Indexes
Migration: `2026_09_05_000700_add_booking_services_crm_query_indexes.php`

| Index | Table |
|-------|--------|
| `(booking_service_id, booking_service_category_id)` | `booking_service_category_service` |
| `(created_at DESC)` | `booking_services` |
| `(is_active, created_at DESC)` | `booking_services` |

(Local planner may still Seq Scan 81-row `latest()` — indexes ready as catalog grows.)

### Frontend
- `BookingServiceEditModal` / `BookingServiceCreateModal` / `BookingServiceBulkUpdateModal` / `ServicePackageFormModal` → `/services/options`.
- Edit modal: removed duplicate `categories?all=1` fetch.

### Routes tagged
`routes/api.php` — `booking-services-crm-query-v1` on services options + categories apiResource comment.

---

## EXPLAIN / SQL after

**List sample:** 8 queries — ACL, count, page, staff, stores, categories, products. **No** questions / options / linked addon services.

**Sort SQL (81 rows):** still Seq Scan + Sort ~0.07 ms (expected at this size).

---

## Residual / P2

- List wall still ~300 ms locally vs ~6 ms SQL — residual Eloquent `toArray` / staff map; further column `select` on list is optional.
- Server-side table column sort.
- `pg_trgm` name search.
- Slim `staffs?per_page=200` for Edit (separate from this page’s worst path).

---

## Files touched

**BE:** `ServiceController.php`, `CategoryController.php`, `routes/api.php`, migration `000700`  
**FE:** `BookingServiceEditModal.tsx`, `BookingServiceCreateModal.tsx`, `BookingServiceBulkUpdateModal.tsx`, `ServicePackageFormModal.tsx`
