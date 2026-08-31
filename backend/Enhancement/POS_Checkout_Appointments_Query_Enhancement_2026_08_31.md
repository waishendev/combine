# POS Checkout + Appointments — Query Enhancement (2026-08-31)

Enhancement id: `pos-appointments-query-v2`  
**Continues:** `POS_Appointments_List_Query_Optimization_P0_P1AB.md` (2026-07-31 / P0 + P1-A + P1-B)

**CRM pages**
- `frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/pos/appointments/page.tsx` → `PosAppointmentsWorkspace` (+ schedule / Request Center)
- `frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/pos/page.tsx` → `PosPageContent` (shares `PosRequestCenter`)

**Constraint:** No change to business logic, financial math, API response keys (except new optional endpoints / query flags that are additive), filters/sort semantics, or user flow.

**Environment (local Postgres):** bookings ≈ 719 · median warm runs via `PosController::runAppointmentSearch` / calendar / summary.

---

## Verdict

| Check | Result |
|--------|--------|
| Schedule grid primary feed | Now `GET /pos/appointments/calendar` (lightweight) |
| Heavy `GET /pos/appointments` money DTO | Still available; SQL-paginated + batched hydrate |
| Request Center badge (both POS pages) | `GET /pos/requests/summary` on mount; full lists on panel open |
| Hold list hydrate | `lite=1` + `statuses=` (identity + hold meta only) |
| API money/status field semantics | Unchanged for full search / detail |
| Cross-request cache | None (request-scoped memo/preload only) |

| Stage | COMPLETED `per_page=50` (local) | Request Center on page mount |
|--------|--------------------------------:|------------------------------|
| Before this wave (full hydrate, no SQL page) | **~12.7 s / 5,487 q** | 3× heavy appointments + ecommerce fan-out |
| After SQL pagination + calendar / statuses | ~1.2 s / ~611 q | 1× statuses hold call |
| After lite + deferred ecommerce | ~0.77 s / ~462 q | lite holds; ecommerce deferred |
| After batch balances / refunds / services + summary | ~0.7–0.8 s / ~300 q | summary only (~25 ms / 7 q) |
| After staff splits + POS cart ID batch | ~543 ms / ~204 q | unchanged summary |
| **After package usages + deposit service preload (final)** | **~355 ms / ~20 q** | summary ~8–27 ms / 7 q |

Calendar month feed stays healthy (**~28–84 ms / ~10–11 q**). Overall vs original heavy list: **~36×** fewer wall ms and **~99%** fewer SQL queries on the local COMPLETED×50 sample.

Treat local numbers as directional; **confirm production latency after deploy**.

---

## Page → API map (after)

### CRM `/pos/appointments`
| UI | API | Notes |
|----|-----|--------|
| Month / day schedule grid | `GET /pos/appointments/calendar` | Slim select + package tone map; day view passes `date=` |
| Open appointment drawer | `GET /pos/appointments/{id}` | Full financial DTO (expected) |
| Request Center badge | `GET /pos/requests/summary` | COUNT-only |
| Open Request Center → holds | `GET /pos/appointments?statuses=HOLD,PENDING,PENDING_CONFIRMATION&lite=1` | One call; no money hydrate |
| Open Request Center → ecommerce / returns | Existing order/return endpoints | Loaded when panel opens (not on mount) |
| Legacy / unpaid / other list callers | `GET /pos/appointments` | Full DTO; SQL `COUNT` + `LIMIT/OFFSET` except `unpaid_only` |

### CRM `/pos` (checkout)
| UI | API | Notes |
|----|-----|--------|
| Request Center badge | Same `GET /pos/requests/summary` | Shared `PosRequestCenter` |
| Open panel holds / lists | Same lite + deferred fan-out | Shared component |

---

## What landed

### A — Calendar feed (schedule UI)
- **New:** `GET /api/pos/appointments/calendar` → `PosController::appointmentCalendar`
- Lightweight columns + eager `customer` / `service` / `staff` / `storeLocation`
- Package paid/unpaid **tone** without full settlement DTO
- Frontend schedule uses calendar only (not heavy search)

### B — SQL pagination on search (except `unpaid_only`)
- `runAppointmentSearch`: `COUNT` + `forPage` then hydrate **current page only**
- `unpaid_only` still hydrate-then-filter (needsSettlement ≠ simple `payment_status`; left intentional)

### C — Request Center load path
- **New:** `GET /api/pos/requests/summary` → `RequestCenterPendingTasksQuery::summaryCounts`
- Multi-status: `statuses=HOLD,PENDING,PENDING_CONFIRMATION` (one round-trip)
- **`lite=1`:** hold-like statuses skip financial / visit hydrate; stub money fields; batch hold deposit meta
- Mount = summary only; ecommerce/returns deferred until panel open
- Staff fetch dedupe + correct `branch_store_location_id` on appointments workspace

### D — Day view range
- Day mode requests a single `date=` (or equivalent day bounds), not the full month

### E — Availability / leave (related POS create/reschedule)
- `BookingAvailabilityService`: sargable `end_at` lower bound; leave date compares without wrapping columns in functions where possible

### F — Indexes
| Migration | Indexes |
|-----------|---------|
| `2027_03_02_000100_add_pos_appointment_calendar_scope_index.php` | Calendar scope on bookings (store + start + id) |
| `2027_03_03_000100_add_pos_appointment_search_perf_indexes.php` | `bookings (store_location_id, status, start_at)`; `pos_cart_service_items (assigned_staff_id, start_at)` |

(Builds on earlier `2026_07_31_000100_add_pos_appointment_list_indexes.php` from P0.)

### G — Search-page batch preloads (request-scoped)
While `appointmentSearch` memo window is open (`begin` → `finally end`):

| Preload | Seeds / replaces |
|---------|------------------|
| Active `order_items` | Existing P1-B |
| `booking_services` (+ `service_type`, `deposit_amount`) | Price meta + deposit breakdown |
| Refunds | Per-page `booking_id IN (…)` |
| Package balances | Customer×service available qty |
| Staff splits + fallback staffs | `staff_splits:…` / `staff_fallback:…` memo |
| POS cart service item IDs | `pos_cart_ids:{bookingId}` (one join) |
| Package usages | `pkg_claims:…` + `pkg_usage_early:{bookingId}` (claims-shaped OR + optional fallback) |

Also:
- Reuse one `resolvePerLinePackageClaims` result inside financial summary / package eligibility
- Skip empty-cart late package lookup that used `whereRaw('1 = 0')` (never matched; same result)
- Eager `service.deposit_amount` on search builder

---

## What was NOT changed

1. Financial / package / deposit / settlement **formulas and thresholds**
2. Full search / detail **JSON keys** used by existing callers
3. `unpaid_only` still post-hydrate filter (no SQL “unpaid” approximation)
4. Request Center summary remains **global** (not branch-scoped) — lists are global today; scoping needs product OK + list wiring together
5. No Redis / static / cross-request cache
6. No “calendar-like” money-less DTO for full `GET /pos/appointments` (would be a product/API change)

---

## Benchmark detail (local)

### Heavy list — COMPLETED `per_page=50`
| Metric | Original | Final (v2) |
|--------|----------|------------|
| Wall (median warm) | ~12.7 s | **~355 ms** |
| SQL queries | ~5,487 | **~20** |

Dominant leftover before final package/deposit batch was ~138× `customer_service_package_usages` + ~50× `booking_services` deposit lookups; those are now page-batched (~2 usages queries + 1–2 services queries).

### Other paths
| Path | Local result |
|------|--------------|
| `GET /pos/appointments/calendar` (month) | ~28–84 ms / ~10–11 q |
| Hold search `lite=1` | ~7–8 ms / ~5 q (0 holds locally) |
| `GET /pos/requests/summary` | ~8–27 ms / 7 q |

---

## Files touched (summary)

### Backend
- `app/Http/Controllers/Ecommerce/PosController.php` — calendar, summary, lite, SQL page, preloads, memo keys
- `app/Support/RequestCenterPendingTasksQuery.php` — `summaryCounts()`
- `app/Services/Booking/BookingAvailabilityService.php` — sargable availability/leave bounds
- `routes/api.php` — calendar + requests/summary (marked `NEW ENHANCEMENT`)
- `database/migrations/2027_03_02_000100_add_pos_appointment_calendar_scope_index.php`
- `database/migrations/2027_03_03_000100_add_pos_appointment_search_perf_indexes.php`

### Frontend
- `src/components/pos/PosAppointmentsWorkspace.tsx` — calendar feed, day `date=`, staff dedupe / branch params
- `src/components/pos/PosRequestCenter.tsx` — summary on mount; `statuses` + `lite=1`; defer ecommerce fan-out
- Shared by `/pos` and `/pos/appointments` via `PosRequestCenter` (`PosPageContent` + appointments workspace)

### Prior doc
- `backend/Enhancement/POS_Appointments_List_Query_Optimization_P0_P1AB.md` — foundation memo + order_items batch (still valid)

---

## Routes marked

In `routes/api.php` under `pos` prefix:

```text
// NEW ENHANCEMENT — pos-appointments-query-v2
GET /api/pos/appointments/calendar
GET /api/pos/requests/summary
// END NEW ENHANCEMENT
```

Existing `GET /api/pos/appointments` keeps the same path; behavior is optimized in-place (additive query flags: `statuses`, `lite`, SQL pagination).

---

## Deploy / verify

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate --force
# optional focused tests if present:
php vendor/phpunit/phpunit/phpunit --filter "PosAppointment"
```

Smoke after deploy:
1. `/pos/appointments` month + day schedule load (calendar network call only for grid)
2. Open Request Center badge count on `/pos` and `/pos/appointments` (summary)
3. Open panel: holds list + ecommerce/returns appear without changing actions
4. Open appointment detail / settle / package apply still match prior money fields
5. Compare APM / slow-query logs for `appointmentSearch` vs calendar

---

## Next steps (not done — need approval)

| Item | Why deferred |
|------|----------------|
| SQL `unpaid_only` prefilter | Easy to wrong-page vs `needsSettlement` |
| Branch-scoped `/pos/requests/summary` | Must change lists + badge together |
| Lighter list DTO for full search | Changes response money fields for callers |
| Extra `(booking_id, status)` on `customer_service_package_usages` | Only if EXPLAIN shows seq scans at larger volume |

---

## Bottom line

`pos-appointments-query-v2` makes the **appointments schedule** and **shared Request Center** (checkout + appointments) load from lightweight endpoints, and reduces full appointment-search hydrate from thousands of queries to ~tens on a 50-row COMPLETED page — **without** changing settlement math or primary API shapes. Confirm real-world latency after migration + deploy.
