# Commission Overview

This document describes how the **current implemented code** handles staff commissions.

## 1) Two commission domains

The system supports two independent commission domains:

- `BOOKING` (booking appointments)
- `ECOMMERCE` (ecommerce order item splits + service package splits)

The domain is carried by `type`:

- `type = BOOKING`
- `type = ECOMMERCE`

`StaffCommissionService::normalizeType()` is the single normalization gate. Any unknown value falls back to `BOOKING`.

---

## 2) Shared monthly table (`staff_monthly_sales`)

Although booking and ecommerce have different data sources and formulas, both finally write into the same monthly table:

- `staff_monthly_sales`

Uniqueness is by:

- `type + staff_id + year + month`

So booking and ecommerce are logically separate ledgers but share the same storage shape and admin workflows (override, freeze/reopen, recalc UI).

---

## 3) Realtime update vs manual recalculate

### Realtime / event-driven update

- **Booking**: when appointment status changes to/from `COMPLETED`, `AppointmentController` calls:
  - `applyCompletedBooking()`
  - `reverseCompletedBooking()`
- **Ecommerce**: model observers trigger recalculation when order/split/package changes:
  - `EcommerceOrderObserver`
  - `EcommerceOrderItemStaffSplitObserver`
  - `EcommerceServicePackageStaffSplitObserver`

Realtime updates are blocked by freeze rule (unless force path is used by manual/command recalc).

### Manual recalculate

Available through:

- Admin API: `POST /admin/booking/commissions/recalculate`
- Artisan command: `php artisan booking:commission-recalculate ...`

Manual recalc can target:

- one staff + one month
- one month + all staff
- all months (`--all`)

---

## 4) Override, freeze/reopen, snapshot roles

### Override (`is_overridden`, `override_amount`)

- If overridden, final `commission_amount` uses `override_amount`.
- If not overridden, final `commission_amount` uses computed formula.
- Override is blocked for frozen month rows.

### Freeze / reopen

- Status values: `OPEN` / `FROZEN`
- `reopen` is an action that sets status back to `OPEN` (not a persistent third status).
- Frozen rows are protected from normal recalc and override operations.

### Snapshot fields

On each successful recalculation, snapshot fields are updated:

- `tier_id_snapshot`
- `tier_percent_snapshot`
- `tier_min_sales_snapshot`
- `calculated_at`

These capture which tier/rate was applied at the time of calculation.

---

## 5) Audit logs (`staff_commission_logs`)

Commission actions are written to `staff_commission_logs`, including:

- `FREEZE`
- `REOPEN`
- `OVERRIDE`
- `RECALCULATE`

Each log stores staff/month/type context plus optional `old_values`, `new_values`, `remarks`, and `performed_by`.
