# Commission Data Structure

This page lists the commission-related tables/fields currently used.

## 1) `staff_commission_tiers`

Purpose:

- tier definitions per commission `type`

Core columns:

- `id`
- `type` (`BOOKING` / `ECOMMERCE`)
- `min_sales` (decimal)
- `commission_percent` (decimal)
- timestamps

Constraints/index:

- unique: `type + min_sales`
- index: `type + min_sales`

Used by:

- `StaffCommissionService::recalculateMonthly()` to select tier by `type` and sales.

---

## 2) `staff_monthly_sales`

Purpose:

- monthly aggregated sales + commission result per staff/type

Key identity:

- unique: `type + staff_id + year + month`

Core metric columns:

- `type`
- `staff_id`
- `year`
- `month`
- `total_sales`
- `booking_count` (used as count for booking/ecommerce)
- `tier_percent`
- `commission_amount`

Override columns:

- `is_overridden`
- `override_amount`

Snapshot columns:

- `tier_id_snapshot`
- `tier_percent_snapshot`
- `tier_min_sales_snapshot`
- `calculated_at`

Month control columns:

- `status` (`OPEN` / `FROZEN`)
- `frozen_at`
- `frozen_by`
- `reopened_at`
- `reopened_by`

Indexes:

- `type + year + month`
- `status`
- `type + year + month + status`

---

## 3) `staff_commission_logs`

Purpose:

- audit trail for commission actions

Columns:

- `id`
- `staff_monthly_sale_id` (nullable)
- `staff_id`
- `type`
- `year`
- `month`
- `action` (e.g. `FREEZE`, `REOPEN`, `OVERRIDE`, `RECALCULATE`)
- `old_values` (json nullable)
- `new_values` (json nullable)
- `remarks` (text nullable)
- `performed_by` (nullable user id)
- timestamps

Indexes:

- `staff_id + type + year + month`
- `action`
- `staff_monthly_sale_id`

---

## 4) Related operational fields outside commission tables

### `bookings.commission_counted_at`

Used by booking realtime flow to avoid double counting when booking status transitions to `COMPLETED`.

---

## 5) Eloquent models

- `App\Models\Booking\StaffCommissionTier`
- `App\Models\Booking\StaffMonthlySale`
- `App\Models\Booking\StaffCommissionLog`

Relations currently present:

- `StaffMonthlySale -> staff`
- `StaffCommissionLog -> staff`
- `StaffCommissionLog -> performer`
