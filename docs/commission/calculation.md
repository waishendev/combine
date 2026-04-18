# Calculation Logic

This document captures the **actual formulas and decision order** in current implementation.

## 1) Booking monthly sales

For a target `staff_id + year + month`:

```text
month_window = [start_of_month, start_of_next_month)
bookings = COMPLETED bookings of that staff within month_window

total_sales   = sum(service.service_price)
booking_count = count(bookings)
```

Then values are written into `staff_monthly_sales(type=BOOKING, staff_id, year, month)`.

---

## 2) Ecommerce monthly sales

For a target `staff_id + year + month`:

```text
month_window = [start_of_month, start_of_next_month)
```

Only orders matching business filters are considered:

- `orders.created_at` inside month window
- status/payment status indicates paid/completed
- exclude cancelled/draft/refunded/refunded_at rows per query conditions

### 2.1 Product split formula

Per row:

```text
effective_line_total = COALESCE(order_items.effective_line_total, order_items.line_total)
share_factor         = order_item_staff_splits.share_percent / 100
rate_factor          =
  if commission_rate_snapshot > 1 then commission_rate_snapshot / 100
  else commission_rate_snapshot

product_component = effective_line_total * share_factor * rate_factor
```

Monthly product sales:

```text
product_sales = SUM(product_component)
product_count = COUNT(order_item_staff_splits.id)
```

### 2.2 Package split formula

Per row:

```text
package_rate_factor =
  if service_commission_rate_snapshot > 1 then service_commission_rate_snapshot / 100
  else service_commission_rate_snapshot

package_component = split_sales_amount * package_rate_factor
```

Monthly package sales:

```text
package_sales = SUM(package_component)
package_count = COUNT(service_package_staff_splits.id)
```

### 2.3 Ecommerce monthly totals

```text
total_sales   = round(product_sales + package_sales, 2)
booking_count = product_count + package_count
```

(`booking_count` is reused as “count” field for both domains.)

---

## 3) Tier matching logic

After monthly totals are set, `recalculateMonthly()` runs tier selection:

```text
tier = first tier where:
  tier.type == monthly.type
  tier.min_sales <= monthly.total_sales
ordered by min_sales DESC
```

If no tier found:

- `tier_percent = 0`

Else:

- `tier_percent = tier.commission_percent`

---

## 4) Commission amount formula

Base computed amount:

```text
commission_computed = round(monthly.total_sales * tier_percent / 100, 2)
```

Final amount decision:

```text
if monthly.is_overridden == true:
  commission_amount = override_amount (default 0 when null)
else:
  commission_amount = commission_computed
```

So override always has priority over formula output.

---

## 5) Snapshot update rules

On each successful `recalculateMonthly()` (not skipped by frozen guard):

- `tier_id_snapshot` ← matched tier id
- `tier_percent_snapshot` ← matched tier percent
- `tier_min_sales_snapshot` ← matched tier min_sales
- `calculated_at` ← now
- `tier_percent` ← same percent used in calculation
- `commission_amount` updated by override rule above

These snapshots are refreshed every successful recalculation.

---

## 6) Frozen guard and force

Default behavior (`force=false`):

- if row status is `FROZEN`, recalculation returns immediately without changing values.

Force behavior (`force=true`):

- frozen guard is bypassed and row is recalculated.
