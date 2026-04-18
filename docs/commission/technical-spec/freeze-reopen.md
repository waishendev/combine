# Freeze / Reopen Rules

This document reflects current implemented behavior.

## 1) Status model

`staff_monthly_sales.status` has two states:

- `OPEN`
- `FROZEN`

Important:

- **REOPEN is an action, not a third status**.
- Reopen action sets `status` back to `OPEN` and writes reopen metadata.

---

## 2) OPEN month behavior

When `status=OPEN`:

- realtime update paths can recalculate normally
- manual recalculate works
- command recalculate works
- override is allowed
- freeze action can be applied

---

## 3) FROZEN month behavior

When `status=FROZEN` and no force flag is used:

- `recalculateMonthly()` returns early (no value update)
- realtime booking/ecommerce triggers do not alter computed monthly values
- API/command recalculate skips row
- override endpoint is blocked (`Frozen month cannot be overridden. Please reopen first.`)

With force (`force=true` / `--force`):

- recalculation bypasses frozen guard and values can be recomputed.

---

## 4) Freeze action

### Per-row freeze

- Endpoint: `PATCH /admin/booking/commissions/{id}/freeze`
- Sets:
  - `status = FROZEN`
  - `frozen_at`
  - `frozen_by`
- Writes `FREEZE` commission log.

### Per-month freeze

- Endpoint: `PATCH /admin/booking/commissions/freeze-month`
- Input: `year`, `month`, optional `type`
- Applies freeze to all matched rows for that month/type
- Writes `FREEZE` logs per row

---

## 5) Reopen action

### Per-row reopen

- Endpoint: `PATCH /admin/booking/commissions/{id}/reopen`
- Sets:
  - `status = OPEN`
  - `reopened_at`
  - `reopened_by`
- Writes `REOPEN` log.

### Per-month reopen

- Endpoint: `PATCH /admin/booking/commissions/reopen-month`
- Input: `year`, `month`, optional `type`
- Applies reopen to all matched rows
- Writes `REOPEN` logs per row

---

## 6) Override vs freeze/reopen

- Override is only allowed in `OPEN` month.
- If month is frozen, admin must reopen first.
- After reopen, override can be edited again and recalculation can run normally.
- If override is set, recalculation still refreshes snapshots/tier but final amount follows override value.

---

## 7) Recommended admin usage

Typical operational pattern:

1. Keep month `OPEN` while data is still changing.
2. Run month recalculation and verify results.
3. Apply manual overrides if needed.
4. Freeze month as closing action.
5. Reopen only when correction is required.
6. If correction must affect frozen data directly, use force recalc in controlled context.
