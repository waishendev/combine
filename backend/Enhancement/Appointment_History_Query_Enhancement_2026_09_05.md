# Appointment History — Query Enhancement ANALYSIS (2026-09-05)

Enhancement id: `appointment-history-query-v1`

**CRM page:** `/booking/appointment-history`  
**APIs:** `GET /api/admin/booking/appointment-history`, `…/{id}`  
**Review:** `Appointment_History_Query_Performance_Review_2026_09_05.md`

**Constraint:** Same JSON shapes, payment-status semantics, filters, and UX. No business-logic changes.

**Environment:** Local Postgres · bookings=724 · median of 5 controller runs.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| List page 1 · 25 rows | **~622 ms / 509 q** | **~158 ms / 23 q** | **−75% / −95%** |
| List 90d page 1 | ~705 ms / 509 q | **~147 ms / 23 q** | **−79% / −95%** |
| `payment_status=paid` · 90d | **~17.5 s / 15,142 q** | **~4.0 s / 109 q** | **−77% / −99%** |
| List `q=a` | ~603 ms / 530 q | **~146 ms / 23 q** | **−76% / −96%** |
| `historyShow` | ~40 ms / 36 q | **~29 ms / 27 q** | −28% / −9 q |

Outer list SQL now uses **Index Only Scan** on `bookings_store_created_id_history_index` (~0.03 ms). Remaining list wall is mostly PHP financial resolution for 25 rows (unavoidable without denormalizing money fields).

`payment_status` still walks all matching bookings in PHP (same semantics / accurate `total`). SQL explosion is gone; further win needs a maintained status column (deferred).

---

## What landed

### P0 — Shared POS financial preload for history list
- `PosController::withAppointmentFinancialPreload()` — same request-local memo + preloads as `appointmentSearch`
- `AppointmentController::mapHistoryBookings()` reuses **one** `PosController` instance (critical: `app(PosController::class)` per row previously discarded memo)
- Preloads: active order items, booking_services, refunds, package balances, staff splits, POS cart ids, package usages, **visit_finalized**
- Chunk size 100 for large `payment_status` passes

### P0 — Batched history staff splits / names
- One `booking_service_staff_splits` query per chunk
- One staff-name lookup for JSON split resolution (`mapHistoryRawStaffSplits`)

### P0 — `payment_status` path
- Still `get()` → map → filter → `forPage` (identical totals / pages)
- Maps via batched preload instead of per-row SQL (~15k → ~109 queries locally)

### P1 — Indexes
Migration `2026_09_05_000200_add_appointment_history_query_indexes.php`:
- `bookings (store_location_id, created_at DESC, id DESC)`
- `booking_service_staff_splits (booking_id)`

### P1 — Sargable `created_at` filters
- Replaced `whereDate('created_at', …)` with `startOfDay` / `endOfDay` timestamp bounds (same calendar-day semantics in app TZ)

### P1 — Visit-finalized batch
- `preloadAppointmentSearchVisitFinalized` seeds memo (also wired into `appointmentSearch`)
- Removes per-row `order_service_items` EXISTS on list hydrate

### P2 — FE staff filter
- `BookingAppointmentHistoryPage` → `/api/proxy/staffs/options/query?per_page=500&is_active=true`

### Routes marked
`routes/api.php`: `// NEW ENHANCEMENT — appointment-history-query-v1`

---

## EXPLAIN (after)

Sargable 90d list LIMIT 25:

```text
Index Only Scan using bookings_store_created_id_history_index
  Index Cond: (store_location_id = 1 AND created_at >= … AND created_at <= …)
Execution Time: ~0.03 ms
```

---

## Deploy notes
1. Run migration `2026_09_05_000200_add_appointment_history_query_indexes`.
2. Smoke appointment history: default page, date range, payment status paid/unpaid/partial, search, open drawer.
3. Spot-check `computed_payment_status` / paid amounts vs a known booking before/after.

---

## Trade-offs
- Preload adds a few wider queries per page; removes hundreds of round-trips.
- `payment_status` remains O(n) CPU over the filtered set (correct totals). Deferred: persisted `computed_payment_status` for SQL `paginate`.
- `visit_finalized` batch SQL mirrors prior EXISTS semantics via `NOT EXISTS` deposit lines; covered by same memo key as before.
- History index adds write cost on booking insert (negligible); split index small.

---

## Deferred (optional v1b)
- Persist / maintain `computed_payment_status` for SQL filter + true pagination under payment filter.
- Fold remaining rare package-usage fallback singles if they show up under larger package volume.
