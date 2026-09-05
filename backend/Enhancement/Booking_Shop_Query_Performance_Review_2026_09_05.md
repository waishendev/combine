# Booking Shop — Query Performance Review (2026-09-05)

**Scope:** `frontend/booking_gentlegurl_shop/src/app/**` + shared layout/components/lib + traced backend under `backend/ecommerce_gentlegurl_backend_api`.

**Constraint:** Analysis only — no business logic / API shape / UI / availability rules / deposit / package / payment changes in this pass.

**Environment (local Postgres):** bookings=725 · booking_services=81 · staffs=12 · schedules=28 · cart_items=165 · leave_requests=365 · service_packages=2 · median of 5 controller benches (where noted).

**Proxy:** Browser → `/api/proxy/*` → `{NEXT_PUBLIC_API_BASE_URL}/api/*` (`apiClient.ts`). Guest: `X-Booking-Guest-Token`. Workspace: `X-Workspace: booking`.

---

## Executive summary

| Journey step | Call | Local wall | Queries | Top issue |
|--------------|------|-----------:|--------:|-----------|
| Catalog | `GET /booking/services?store_location_id=` | **~802–824 ms** | **~261** | List `mapService` still loads **questions+options** + **primary_slots** per service (N+1). Table UI needs price/duration/image/categories only |
| Slots | `GET /booking/availability/pooled` | **~1072 ms** | **~859** | Per staff × every 15‑min candidate → full `hasConflict` (5–6 queries). POS already has day prefetch shop never uses |
| One staff day | `getAvailableSlots` | **~262 ms** | **~213** | Same conflict fan-out |
| Service detail | `GET /booking/services/{id}` | **~11 ms** | 8 | OK for Edit/addon path |
| Cart poll | `GET /booking/cart` | **~2 ms** | 2 | Cheap, but Header polls **every 5s** on all pages |
| Packages | `GET /service-packages` | **~3 ms** | 2 | Already slim (`items: []`) |
| Homepage settings | `GET /public/shop/homepage?type=booking` | (cached SSR; many **client** repeats) | — | Deposit note / slots help / max advance / gateways / TNC / policy each re-fetch full homepage |
| Account history | `GET /public/shop/bookings` | (scales with N bookings) | **O(N) financial queries** | List+detail+transactions share one fat `MyBookingController@index` |

**Priority themes**

1. **P0 BE — services list:** Stop loading questions/options + per-row primary_slots on `ServiceController@index` (keep on `show`). Same pattern as CRM services/products list slim.
2. **P0 BE — availability pooled:** Reuse/adapt `prefetchPosDayAvailabilityContext` / in-memory conflict eval for **shop** pooled path (preserve exact slot + staff_ids semantics). Do **not** change availability rules.
3. **P0 FE — duplicate fetches:** Service detail ×3 (service→slots→staff); pooled ×2 (slots+staff); homepage settings helpers × many; packages Header+page; cart 5s poll + drawer open.
4. **P1 FE/BE — account bookings:** Batch deposit/receipt/refund/financial summary; optional slim list vs detail payload (additive endpoint = P2 if response must stay identical for list).
5. **P1 indexes:** Conflict query often hits `(status, start_at)` then filters `staff_id` — consider `(staff_id, status, start_at)` after plan confirmation.
6. **P2:** Dedicated settings slice endpoint; precomputed availability; stop Header cart poll when drawer closed / use longer interval / ETag.

---

## Main user journey (what is actually called)

```
[/] SSR landing + sliders + layout homepage (React.cache)
      │
[/booking] stores → categories → GET /booking/services   ← P0 ~800ms
      │
[/booking/service/{id}] GET /booking/services/{id} + homepage (deposit note)
      │
[/booking/service/{id}/slots] GET service again + homepage×2 + GET /availability/pooled  ← P0 ~1s
      │
[/booking/service/{id}/staff] GET service again + stores + GET /availability/pooled again  ← P0
      │  Confirm → POST /booking/cart/add (+ optional photos)
      │
Header CartDrawer: GET cart + homepage×N + banks + billplz×2 + stores + my packages
      │  checkout → POST /booking/cart/checkout(|-member) → POST /{id}/pay → Billplz or /payment-result
      ▼
[/payment-result] lookup booking/order
[/account/bookings] + [/account/bookings/{id}] GET /public/shop/bookings (full fat index)
[/services-packages] GET /service-packages (+ Header duplicate)
```

**ACTION note:** Almost all ACTIONs are **on-page** (modals/drawers) or continue the multi-step booking path. No CRM-style Edit route; account detail is a **page** that reuses list API.

Static (`privacy-policy`, `shipping-policy`, `return-refund`, `contact`): no page API; still inherit layout homepage + Header cart/packages poll. `/flush` intentionally hits homepage flush-cache.

---

## A) Catalog — `/booking` services list

| # | Item | Detail |
|---|------|--------|
| 1 | Page / action | `/booking` after branch (+ category / search) |
| 2 | Frontend | `BookingPageContent.tsx` → `getBookingServices` |
| 3 | API | `GET /booking/services?store_location_id=&category_id=` |
| 4 | Backend | `App\Http\Controllers\Booking\ServiceController@index` → `mapService(..., includeDescription=false)` |
| 5 | Pattern | Batch staff OK (`loadStaffPayloadsByServiceIds`). But **every** `mapService` still runs `primarySlots()` query + `questions()->with(options.linked…)` |
| 6 | Why slow | Local: **~824 ms / 261 q** — breakdown ~**128 questions** + **~79 primary_slots** (+ services/staff/categories). Card UI uses duration, price, image, categories — **not** questions/slots |
| 7 | Indexes | Service list filters by store via `whereHas`; PK / active indexes sufficient at n≈81 |
| 8 | EXPLAIN | Not the bottleneck (PHP N+1 dominates) |
| 9 | Rec | **P0:** `forList` path: `questions: []`, skip primary_slots query (or empty array / omit load). Keep full graph on `show` (addons page needs it) |
| 10 | Benefit | Expect ~10× fewer queries; wall toward tens of ms |
| 11 | Trade-off | Any client reading list `questions` must use `show` (shop cards do not) |
| 12 | Safe? | **Yes** if response keys preserved as empty arrays |

---

## B) Availability — slots + staff pages

| # | Item | Detail |
|---|------|--------|
| 1 | Page / action | Date pick on `/slots`; remount/verify on `/staff` |
| 2 | Frontend | `slots/page.tsx`, `staff/page.tsx` → `getAvailabilityPooled` |
| 3 | API | `GET /booking/availability/pooled?service_id&date&store_location_id` (+ optional `extra_duration_min`) |
| 4 | Backend | `AvailabilityController@pooled` → foreach staff `BookingAvailabilityService::getAvailableSlots` → per candidate `hasConflict` → `getConflictDiagnostics` |
| 5 | Pattern | ~15‑min steps over schedule windows; each conflict check hits bookings + cart_items + pos_cart_service_items + timeoffs + leave_requests + blocks |
| 6 | Why slow | Local: **4 staff**, duration 20 → **~1072 ms / 859 q** pooled; **1 staff ~262 ms / 213 q**. SQL each ~0.1 ms; **query count** dominates |
| 7 | Indexes | `(staff_id, start_at)`, `(status, start_at)`, store composites, schedules `(staff_id, day_of_week, is_active)`, leave/blocks staff/time — present |
| 8 | EXPLAIN | Conflict sample used `bookings_store_status_start_index`, then **Filter staff_id** (49 rows removed) · **~0.11 ms**. Suggests better `(staff_id, status, start_at)` could cut filter noise at scale |
| 9 | Rec | **P0:** Shop pooled should day-prefetch like `prefetchPosDayAvailabilityContext` + evaluate in memory (same predicates/scopes=`SCOPE_CUSTOMER`). **P1:** optional composite index after EXPLAIN on production-like volume. **Do not** change slot step, buffer, primary-slot policy, or blocking statuses |
| 10 | Benefit | POS path already proves order-of-magnitude fewer queries for same day |
| 11 | Trade-off | Careful parity testing vs current conflict edge cases (buffers, ignore lists, leave half-days) |
| 12 | Safe? | **Yes if** bit-identical available slots + `available_staff_ids` for same inputs |

**Also:** `applyPrimarySlotDisplayPolicy` re-queries `primarySlots()` even when controller eager-loaded them (× staff in pooled) — **P1** pass loaded relation.

**FE P0:** Staff page re-calls pooled after slots already computed `available_staff_ids` — can verify subset without full day regen if semantics allow (or cache last pooled response in session — careful = P2).

---

## C) Service detail ×3 + homepage settings fan-out

| # | Item | Detail |
|---|------|--------|
| 1–3 | service → slots → staff each call `getBookingServiceDetail`; slots also `getBookingSlotsHelpNoteSettings` + `getBookingMaxAdvanceDays` (each full homepage) |
| 4–6 | Show ~11 ms OK; waste is **repeat**. Homepage helpers each `GET /public/shop/homepage?type=booking` |
| 9 | **P0 FE:** lift service detail in shared state / `sessionStorage` for journey; one homepage settings fetch shared by deposit note / help / max days / cart TNC / gateways |
| 12 | Safe — no API change |

SSR already `React.cache`s homepage in `serverHomepage.ts`; **client** path does not.

---

## D) Cart / checkout / pay

| Area | Finding |
|------|---------|
| `GET /booking/cart` | ~2 ms / 2 q — healthy |
| Header `setInterval(..., 5000)` | Polls cart on **every** route including privacy/contact — unnecessary load + battery |
| CartDrawer open | Re-fetches cart + homepage×N + banks + billplz×2 + stores + my packages |
| `POST /cart/add` | Single `hasConflict` — OK |
| Checkout | Per-line re-validate conflict — OK for small carts; P1 if multi-item carts grow |
| Pay / payment-result / pay-link | Lookup + gateway config; not the top latency vs slots/list |

**P1 FE:** Poll only while cart non-empty / page visible; longer interval; skip poll on static policy pages.

---

## E) Account bookings / detail / transactions

| # | Item | Detail |
|---|------|--------|
| 1 | `/account/bookings`, `/account/bookings/[id]`, transactions | |
| 3 | `GET /public/shop/bookings` | |
| 4 | `Booking\MyBookingController@index` | |
| 5 | Unpaginated `->get()` for customer; claims mapWithKeys may hit DB **per booking**; then **per booking** `OrderItem` deposit + receipts + refunds + `resolveAppointmentFinancialSummary` (multi-query) |
| 6 | Scales with customer booking count; detail page loads **entire history** then filters client-side |
| 7 | `bookings (customer_id, start_at)` — EXPLAIN **~0.04 ms** for id list |
| 9 | **P1:** Batch deposit items / receipts / refunds / package claims by `whereIn(booking_id)`. **P2:** `GET .../bookings/{id}` slim show; paginate list (would need FE change — only if product accepts) |
| 12 | Batching preserving payload = safe |

---

## F) Packages / auth / misc

| Area | Finding |
|------|---------|
| `/services-packages` | Packages list already slim; Header also loads packages → duplicate |
| Login/register/forgot/reset/verify | Auth endpoints — not query-hot vs availability |
| Wallet / transactions | Separate wallet APIs; transactions page also pulls bookings list |
| Landing `/` | Server landing + sliders — OK; ensure no accidental N+1 in landing JSON builders (spot-check on implement) |

---

## G) Indexes — recommendations

| Index | Supports | Notes |
|-------|----------|-------|
| `bookings (staff_id, status, start_at)` | Conflict overlap by staff + blocking statuses | EXPLAIN currently picks status/store index then filters staff — **P1**, validate with `EXPLAIN` on prod-like data; overlaps existing `(staff_id, start_at)` partially |
| Existing schedule/leave/block/cart indexes | Already good for single-lookup | Prefer **prefetch** over more indexes for availability |
| `service_packages (is_active)` | Optional if filtered often | Low urgency (n=2) |

Do **not** create one giant `(store, staff, service, date, status)` index — shop conflict is staff+time+status, schedules are staff+dow, leave is staff+dates.

---

## H) Benchmark baseline (local · median of 5)

| Call | Wall | Queries | Notes |
|------|-----:|--------:|-------|
| `GET /booking/services` | **~802–824 ms** | **261** | questions 128 + primary_slots 79 |
| `GET /booking/services/{id}` | ~11 ms | 8 | |
| `GET /availability/pooled` (4 staff) | **~1072 ms** | **859** | 2 visible slots |
| `getAvailableSlots` 1 staff | **~262 ms** | **213** | |
| `GET /booking/cart` | ~2 ms | 2 | |
| `GET /service-packages` | ~3 ms | 2 | |
| Conflict SQL (sample) | ~0.11 ms | — | staff filter after status index |
| Customer bookings id list SQL | ~0.04 ms | — | |

---

## I) Recommended implementation order (when approved)

### P0 (safe / high impact)
1. Slim public `ServiceController@index` `mapService` — empty questions (+ skip primary_slots load); keep `show` full.
2. Wire shop `pooled` to day-prefetch conflict evaluation (parity with POS customer scope) — **behavior-preserving**.
3. FE: dedupe service detail + homepage settings in booking journey; reduce Header cart poll aggressiveness on static pages.

### P1
4. Pass eager `primarySlots` into display policy (no re-query).
5. Batch `MyBookingController` financial/claims queries.
6. Consider `bookings (staff_id, status, start_at)` after EXPLAIN on larger staff booking volumes.
7. Cart drawer: reuse last homepage/settings snapshot.

### P2 (recommend only)
8. Dedicated `GET /booking/{id}` for account detail; paginate history.
9. Client-side pooled result reuse slots→staff.
10. Precomputed / cached availability windows.
11. Slim public homepage “settings” projection endpoint.

---

## J) Files referenced

**FE:** `BookingPageContent.tsx`, `booking/service/[id]/page.tsx`, `slots/page.tsx`, `staff/page.tsx`, `CartDrawer.tsx`, `Header.tsx`, `apiClient.ts`, `serverHomepage.ts`, account bookings pages, `ThankYouClient`, `PayLinkClient`, `services-packages/page.tsx`

**BE:** `Booking\ServiceController`, `Booking\AvailabilityController`, `Booking\BookingAvailabilityService`, `Booking\CartController`, `Booking\MyBookingController`, `Booking\PaymentController`, `ServicePackageController`, `PublicHomepageController`

---

**Next step:** Wait for approval (“做完全部”) before implementing. Highest ROI: **services list N+1** + **pooled availability prefetch** + **FE duplicate homepage/service fetches**.
