# Staff-free / Hidden Product / Snapshot Validation Guide (TASK 1-4)

This guide helps you manually verify all completed tasks end-to-end.

## Preconditions

- Backend API running (`backend/ecommerce_gentlegurl_backend_api`)
- CRM frontend running (`frontend/ecommerce_gentlegurl_crm`)
- Shop frontend running (`frontend/ecommerce_gentlegurl_shop`)
- DB migrated with latest schema
- You have at least:
  - one admin/cashier user (no `staff_id`)
  - one staff-linked user (`users.staff_id` not null)

---

## TASK 1 — DB fields + snapshots

### 1) Check new columns exist

- `products`:
  - `is_hidden_in_shop` (default false)
  - `is_staff_free` (default false)
- `order_items`:
  - `unit_price_snapshot`
  - `line_total_snapshot`
  - `effective_unit_price`
  - `effective_line_total`
  - `is_staff_free_applied` (default false)

### 2) Backfill sanity check

For old `order_items`, verify:
- `unit_price_snapshot` ~= old unit price snapshot
- `line_total_snapshot` ~= old line total
- `effective_*` equals snapshot values
- `is_staff_free_applied = false`

---

## TASK 2 — SHOP hide products

### 1) In CRM product create/edit

Set **Hide in Shop = ON** for a product and save.

### 2) Shop listing check

- Open shop product list (or call public products API)
- Hidden product should **not** appear.

### 3) Shop detail check

- Open hidden product old URL (`/product/{slug}`)
- Should return **not found / 404**.

### 4) POS/CRM check

- Same product should still be visible in CRM/POS product flow.

---

## TASK 3 — POS staff-free effective pricing

### Test data setup

Set a product with:
- **Staff Free Product = ON**
- active and sellable

### A) Staff user checkout (has `staff_id`)

1. Login CRM as staff-linked user
2. Add staff-free product in POS cart
3. Expected in cart:
   - unit price shows `RM 0.00`
   - line total shows `RM 0.00`
4. Checkout and open receipt/invoice
5. Expected receipt totals:
   - item line total `RM 0.00`

DB verify in `order_items` row:
- `unit_price_snapshot` = original unit price at checkout time
- `line_total_snapshot` = original line total
- `effective_unit_price` = 0
- `effective_line_total` = 0
- `is_staff_free_applied` = true

### B) Admin/cashier checkout (no `staff_id`)

1. Login CRM as admin/cashier
2. Add same staff-free product in POS cart
3. Expected in cart:
   - normal selling price
4. Checkout and receipt should show normal amount

DB verify:
- `effective_*` equals snapshot values
- `is_staff_free_applied` = false

---

## TASK 4 — Reports + commission base

Date range should include the above test orders.

### 1) Staff Commission report

Check summary:
- `Total Sales` and `Total Commission` are based on **effective** totals
- New metrics visible:
  - `Free Items Count`
  - `Free Items Value (Snapshot)`
  - `Free Items Actual (Effective)`

Check detail drawer row for staff-free item:
- Snapshot amount > 0
- Effective amount = 0
- Staff item commission = 0 (or computed from effective = 0)

### 2) My POS Summary report

Check summary cards:
- `Free Items Count`
- `Free Items Value (Snapshot)`
- `Free Items Actual (Effective)`

Check table/detail row:
- snapshot value present
- effective value present
- `Staff-Free = Yes` for staff-free consumed item

### 3) Commission pollution check

For a staff-free item order:
- it contributes to snapshot visibility metrics
- it does **not** inflate commission payout (effective amount is base)

---

## Quick checklist

- [ ] CRM create/edit can toggle Hide in Shop / Staff Free
- [ ] Hidden product invisible in SHOP, still usable in CRM/POS
- [ ] Staff user sees RM0 for staff-free item in POS cart/checkout/receipt
- [ ] Non-staff user sees normal price for same item
- [ ] `order_items` snapshot/effective fields stored correctly
- [ ] Reports show free-item snapshot/effective metrics
- [ ] Commission uses effective totals only
