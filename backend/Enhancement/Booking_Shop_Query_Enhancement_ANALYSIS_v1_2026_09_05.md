# Booking Shop — Query Enhancement ANALYSIS v1 (2026-09-05)

Enhancement id: `booking-shop-query-v1`

**Shop app:** `frontend/booking_gentlegurl_shop`  
**Review:** `Booking_Shop_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / availability rules / deposit / package / payment / response-key changes. List keeps `questions: []` / `primary_slots: []`. Show + conflict semantics unchanged.

**Environment:** Local Postgres · bookings=725 · services=81 · staffs=12 · schedules=28 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| **`GET /booking/services`** | **~824 ms / 261 q** | **~78 ms / 5 q** | Dropped list questions + primary_slots N+1 |
| **`GET /availability/pooled`** (4 staff) | **~1072 ms / 859 q** | **~56 ms / 18 q** | Day-prefetch conflicts (SCOPE_CUSTOMER + branch filters) |
| `GET /booking/services/{id}` | ~11 ms / 8 q | **~10 ms / 7 q** | Unchanged full graph |
| Homepage settings helpers (FE) | N full homepage GETs | **1 inflight + 30s TTL** | Shared client cache |
| Header cart poll | every **5s** all pages | **15s** (60s on static) + skip when tab hidden | |
| Account `MyBookingController` | per-booking claims + deposits + settings | **batched** claims/deposits + settings once | Receipts/summary still per-row (residual) |

Availability slot counts unchanged in local bench (2 visible slots). ACTION UX unchanged.

---

## What was wrong

1. Public services **list** called `mapService` which loaded questions/options + primary_slots **per service** (~261 queries).
2. Shop **pooled** availability called `hasConflict` (5–6 queries) for every 15‑min candidate × every staff; POS already had day prefetch.
3. Client re-fetched full homepage for each settings helper; service detail ×3 across journey; Header cart polled every 5s globally.
4. Account bookings N+1 on package claims, deposit OrderItems, and `BookingSetting::first()`.

---

## What landed

### Backend — services list
- `Booking\ServiceController@index` → `mapService(..., forList: true)` returns empty `questions` / `primary_slots`; staff + categories unchanged.
- `show` still eager-loads questions/options/primarySlots.

### Backend — availability pooled
- `prefetchShopDayAvailabilityContext` → `prefetchPosDayAvailabilityContext(..., SCOPE_CUSTOMER, storeLocationId)` with branch filters on timeoff/leave/blocks (parity with `getConflictDiagnostics`).
- `getAvailableSlots` accepts optional conflict context; uses in-memory `evaluatePrefetchedStaffConflict`.
- `applyPrimarySlotDisplayPolicy` reuses eager-loaded `primarySlots`.
- Single-staff `GET /availability` path unchanged (no context → legacy DB conflict checks).

### Backend — account bookings
- Batch package usages by booking ids; batch deposit `OrderItem`s; load `BookingSetting` once into `resolveAppointmentFinancialSummary`.

### Indexes
Migration `2026_09_05_000900_add_booking_shop_query_indexes.php`: `bookings (staff_id, status, start_at)`.

### Frontend
- `apiClient`: shared homepage payload (inflight + 30s TTL); service detail 60s TTL cache.
- `Header`: cart poll 15s (60s on privacy/shipping/return-refund/contact/flush); skip when `document.hidden`.

### Routes tagged
`booking-shop-query-v1` on `/booking/services` index + `/availability/pooled`.

---

## ACTION / journey map (unchanged UX)

| Step | Change |
|------|--------|
| Catalog | Faster list; same cards |
| Service → slots → staff | Detail cached; pooled ~20× fewer queries |
| Cart / pay / payment-result | Homepage settings deduped in drawer |
| Account list/detail | Same payload; fewer claim/deposit/settings queries |
| Static pages | Less aggressive cart poll |

---

## Residual / P2

- `MyBookingController` still runs receipts / refunds / full financial summary per booking — further batching optional.
- Staff page still re-calls pooled (now cheap); client reuse of slots→staff map is optional.
- Dedicated account `GET bookings/{id}` + pagination remain P2.

---

## Files touched

**BE:** `Booking/ServiceController.php`, `Booking/AvailabilityController.php`, `Booking/BookingAvailabilityService.php`, `Booking/MyBookingController.php`, migration `000900`, `routes/api.php`  
**FE:** `apiClient.ts`, `Header.tsx`
