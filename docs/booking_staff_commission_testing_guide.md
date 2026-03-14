# Booking Staff Commission — Testing Guide

This guide explains how to test the **Booking Staff Commission** feature immediately (no need to wait month-end).

---

## 1) What is covered

- Commission based on **booking service price** (`service_price`), not deposit.
- Commission counted **per staff** and **per month**.
- Tier model: **MODE A** (flat percent based on highest tier reached in month).
- Commission only counted when booking status is `COMPLETED`.
- Revert behavior: if `COMPLETED` is changed to another status, sales/commission are reversed.
- Admin can override monthly commission manually.
- Admin/CLI supports on-demand recalculation for testing.

---

## 2) Quick setup for test data

> Run in backend project folder:
>
> `backend/ecommerce_gentlegurl_backend_api`

### Option A — Seed commission-focused fixtures (recommended)

```bash
php artisan booking:commission-seed-testing --fresh
```

What this gives you:
- Commission tiers (0 / 5000 / 8000).
- Multiple staffs.
- Completed bookings with `completed_at` in different months.
- Monthly sales fixture rows including override example.

### Option B — Seed booking fixtures

```bash
php artisan booking:seed-testing --fresh
```

This also prepares booking/service data and can be used to manually switch status from `CONFIRMED` to `COMPLETED`.

---

## 3) Test from Admin UI

## A. Service price setup

1. Go to: `/booking/services`
2. Create/Edit a service and set `Service Price`.
3. Save.

✅ Expected: value is persisted and shown in service list.

---

## B. Commission tiers

1. Go to: `/booking/commission-tiers`
2. Create/Edit/Delete tier rows.

Example:
- min_sales: 0 => 0%
- min_sales: 5000 => 5%
- min_sales: 8000 => 10%

✅ Expected: tiers are reflected in future recalculation.

---

## C. COMPLETED adds sales

1. Go to: `/booking/appointments`
2. Pick a non-completed booking (e.g. `CONFIRMED`) with assigned staff and service.
3. Change status to `COMPLETED`.

Then verify in `/booking/commissions`:
- staff + current month row exists/updates
- `total_sales` increased by service `service_price`
- `booking_count` +1
- tier and commission recalculated

---

## D. Revert from COMPLETED removes sales

1. On the same booking, change status from `COMPLETED` to e.g. `CANCELLED`.

Then verify in `/booking/commissions`:
- `total_sales` reduced by same service price
- `booking_count` -1
- tier and commission recalculated

---

## E. Override monthly commission

1. Go to: `/booking/commissions`
2. Click `Override` on a row and input a custom amount.

✅ Expected:
- `is_overridden = true`
- `commission_amount = override_amount`
- later recalculation keeps overridden amount unless override is removed.

---

## 4) Recalculate tools (for immediate QA)

### CLI: Recalculate one staff in one month

```bash
php artisan booking:commission-recalculate 2026 3 --staff_id=12
```

### CLI: Recalculate all staff in one month

```bash
php artisan booking:commission-recalculate 2026 3
```

### API: Recalculate one staff in one month

`POST /api/admin/booking/commissions/recalculate`

```json
{
  "year": 2026,
  "month": 3,
  "staff_id": 12
}
```

### API: Recalculate all staff in one month

`POST /api/admin/booking/commissions/recalculate`

```json
{
  "year": 2026,
  "month": 3
}
```

---

## 5) Verification checklist

- [ ] Service has correct `service_price`
- [ ] Appointment set to `COMPLETED` updates monthly sales immediately
- [ ] Revert from `COMPLETED` removes previously counted sales
- [ ] Tier percent follows highest reached `min_sales`
- [ ] Commission = `total_sales * tier_percent / 100` (unless overridden)
- [ ] Override works and displays in commission table
- [ ] On-demand recalculation API/CLI returns expected rows

---

## 6) Troubleshooting

- If monthly row does not change:
  - ensure booking has `staff_id`, `service_id`, and service has `service_price`
  - ensure status transition really changed into/out of `COMPLETED`
- If artisan command fails with autoload error:
  - run `composer install` in backend first.

