# Commission Flow (As Implemented)

This file documents the actual runtime flow in the current code.

## A. Booking commission flow

### A1) Booking moves into COMPLETED

1. `AppointmentController` updates booking status.
2. If status becomes `COMPLETED`, controller calls `StaffCommissionService::applyCompletedBooking()`.
3. Service checks:
   - booking status is `COMPLETED`
   - has `staff_id`
   - not already counted (`commission_counted_at` must be null)
4. Service resolves month from `completed_at` (or `now()` fallback).
5. Service creates/fetches monthly row in `staff_monthly_sales` with `type=BOOKING`.
6. Adds current service price to `total_sales`, increments `booking_count`.
7. If row is `FROZEN`: stop (no recalc update).
8. If row is open: run `recalculateMonthly()`.
9. Mark booking `commission_counted_at`.

### A2) Booking leaves COMPLETED

1. In status transition from `COMPLETED` to non-completed, controller calls `reverseCompletedBooking()`.
2. Service finds the same month row by booking completed date.
3. Subtracts service price, decrements count (floor at 0).
4. If row is `FROZEN`: stop.
5. If row is open: run `recalculateMonthly()`.
6. Reset booking `commission_counted_at` to null.

---

## B. Ecommerce commission flow

Ecommerce is recalculated from source data rather than maintaining increments.

### B1) Order-level observer

`EcommerceOrderObserver` on save/delete:

1. Determine affected month from `orders.created_at`.
2. Recalculate all staff rows for that month (`type=ECOMMERCE`).
3. If `created_at` changed, also recalc original month.

### B2) Order item split observer

`EcommerceOrderItemStaffSplitObserver` on save/delete:

1. Resolve parent order `created_at` from `order_items -> orders`.
2. Recalculate row for current `staff_id` and that month (`type=ECOMMERCE`).
3. If `staff_id` changed, also recalc old staff for same month.

### B3) Service package split observer

`EcommerceServicePackageStaffSplitObserver` on save/delete:

1. Resolve order `created_at` from `orders`.
2. Recalculate row for current `staff_id` and that month (`type=ECOMMERCE`).
3. If `staff_id` changed, also recalc old staff.

---

## C. Frozen month behavior in flow

When a monthly row is `FROZEN`:

- normal recalc methods return without changing row values
- realtime update paths (booking apply/reverse, ecommerce observer-triggered recalc) effectively do not mutate frozen row calculation outputs
- override API is blocked with validation error

So freeze acts as protection against accidental recalculation.

---

## D. Manual recalculate flow (API)

Endpoint: `POST /admin/booking/commissions/recalculate`

1. Validate request (`year`, `month`, optional `staff_id`, optional `type`, optional `force`).
2. Normalize type.
3. Branch:
   - With `staff_id`: recalc one row context (staff + month + type)
   - Without `staff_id`: recalc all staff for that month + type
4. For each returned row, write `RECALCULATE` log.
5. Respond with mode + rows + count.

### Force behavior

- `force=false` (default): frozen rows are skipped by service guards.
- `force=true`: service recalculates even frozen rows.

---

## E. Manual month freeze/reopen flow

### Freeze month

1. `PATCH /admin/booking/commissions/freeze-month`
2. Validate `year`, `month`, optional `type`
3. Fetch rows for that month/type via `monthRows()`
4. For each row:
   - set status to `FROZEN` + frozen metadata
   - write `FREEZE` log

### Reopen month

1. `PATCH /admin/booking/commissions/reopen-month`
2. Validate `year`, `month`, optional `type`
3. Fetch rows for that month/type
4. For each row:
   - set status to `OPEN` + reopen metadata
   - write `REOPEN` log
