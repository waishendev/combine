# CRM Booking Categories (+ Services residual) — Query Enhancement ANALYSIS (2026-09-05)

Enhancement id: `booking-categories-crm-query-v1` (+ residual `booking-services-crm-query-v1b`)

**CRM pages**
- `/booking/categories` (`BookingServiceCategoriesTable`)
- Related ACTION from categories Edit → product-category picker
- Residual opts on `/booking/services` list + Edit/Create staff dropdown

**Prior:** `Booking_Services_CRM_Query_*` (list slim / options / categories?all=1 batch)  
**Constraint:** No business logic / ACTION navigation / response-key changes for table consumers.

**Environment:** Local Postgres · service_categories=7 · services=81 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| **Categories list** `per_page=50` | ~71 ms / 7 q | **~17 ms / 6 q** | Drop full `services.storeLocations` hydrate → **1 distinct join** |
| Categories + branch | ~69 ms / 8 q | **~22 ms / 7 q** | Same |
| `categories?all=1` | ~12–15 ms / 4 q | ~13 ms / 4 q | Already slim (v1) |
| **product-categories?all=1** (Edit linked picker) | heavy `products.linkedBookingService.storeLocations` | **~8 ms / 3 q** | id/name only |
| Services list (residual) | ~294–343 ms / 8 q | **~178 ms / 8 q** | Lean `select` + no `toArray` on list |
| Services options | ~19 ms | ~20 ms | Unchanged |
| Edit/Create staff | full `/staffs?per_page=200` | **`/staffs/options/query`** | id/name only |

ACTION UX unchanged: Edit / Create / Delete / Move up-down / Bulk / Import-Export stay on-page.

---

## Categories page — what was wrong

Paginated `GET /admin/booking/categories` still eager-loaded **every service** under each category plus their store locations, only to compute unique `store_locations` for the “Available At” column. SQL also pulled full `booking_services.*` (~70 ms with 7 cats / 81 services; scales with catalog).

Edit modal `GET categories/{id}` was already cheap (~4 ms). Linked product-category dropdown hit `product-categories?all=1` with the same heavy branch graph.

---

## What landed

### Backend — service categories list
- No `with(services.storeLocations)` on paginated index.
- `loadStoreLocationsForCategories()` — `DISTINCT` join  
  `booking_service_category_service` → `booking_service_store_location` → `store_locations`.
- `formatCategory` + `store_locations` array (same shape for FE `branchNames`).
- `all=1` path unchanged from services v1 (empty `store_locations`, batched linked product cats).

### Backend — product categories (categories Edit ACTION)
- `all=1`: select id/name/cn_name/flags only; **no** products graph; `store_locations: []`.
- Paginated / legacy full list: same join-style branch metadata (no nested Eloquent graph).

### Backend — services residual (v1b)
- List query: explicit column `select` (no rules_json blob, etc.).
- `formatService(..., forList: true)` builds lean array (no `toArray()` merge).

### Frontend
- Service Edit / Create / Bulk staff pickers → `GET /staffs/options/query?per_page=200&is_active=true`.

### Routes tagged
`booking-categories-crm-query-v1` on categories + product-categories apiResource comments.

---

## ACTION map (`/booking/categories`)

| Action | UI | APIs / change |
|--------|----|----------------|
| **Edit** | Modal | `GET/PUT categories/{id}` OK; product link uses slim `product-categories?all=1` |
| **Create** | Modal | `POST categories` |
| **Delete** | Modal | `DELETE categories/{id}` |
| **Move up/down** | In-row | `POST .../move-up\|down` — list still in-memory swap (no full refetch) |
| **Bulk** | Modal | `PUT categories/bulk` |
| **Import / Export** | Toolbar | Full dump by design |

No route navigation to a separate Edit page.

---

## Sample SQL (categories list after)

1. ACL role + accessible stores  
2. count + page categories (`EXISTS` service→store)  
3. batch linked product categories  
4. **one** `DISTINCT` pivot join for store locations  

No `select booking_services.*` for the page.

---

## Residual / P2

- Services list still ~180 ms vs ~6 ms SQL — further staff `withCount` / name-only without full staff rows optional.
- Categories without any services remain hidden by `whereHas` (ACL semantics — leave as-is).
- `pg_trgm` name search on categories/services.

---

## Files touched

**BE:** `CategoryController.php`, `BookingProductCategoryController.php`, `ServiceController.php` (v1b), `routes/api.php`  
**FE:** `BookingServiceEditModal.tsx`, `BookingServiceCreateModal.tsx`, `BookingServiceBulkUpdateModal.tsx` (staff options)
