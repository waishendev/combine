# Profit & Loss + Cash Shifts — Query Enhancement (2026-09-04)

Enhancement id: `profit-loss-cash-shifts-query-v1`

**CRM pages**
- `/reports/profit-loss` — reviewed; left as year aggregates (no rewrite)
- `/reports/cash-shifts` — report + summary hot path

**Constraint:** Same JSON shapes, filters, and cash-sales formula. Legacy CLOSE rows without `linked_open_shift_id` still report **0** cash sales.

**Environment:** Local Postgres · pos_cash_shifts=189 · CLOSE backfilled=104 · median of 5.

---

## Verdict

| Path | Before | After | Delta |
|------|--------|-------|-------|
| Cash report 90d wall | **~780 ms** | **~150–205 ms** | **−74%+** |
| Cash report 90d queries | **226** | **~36** | **−84%** |
| `order_payments` scans | **~204** | **~20** (OPEN rows on page only) | **−90%** |
| Period `cash_sales` / `difference` | 13718.6 / −9070.4 | **same** | Preserved |
| P&L year | ~20 ms / 7 q | unchanged | — |

---

## What landed

### P0 — `cash_sales_snapshot` on CLOSE
- Migration `2026_09_04_000200_add_cash_sales_snapshot_to_pos_cash_shifts.php`
- Set on `close()` using the same live formula
- Local backfill for existing CLOSE rows (linked-open window; orphans → 0)
- Report reads snapshot first (O(1) per CLOSE)

### P0 — Request-memo live cash sales
- `PosCashShiftCashSalesService` — same payment + fallback SQL; memo on `request()->attributes`
- Used for OPEN shifts and any CLOSE still missing snapshot

### P0 — Slim / SQL period summary
- When no null snapshots: **one** `SUM(cash_sales_snapshot)` aggregate (no model load / no serialize)
- Fallback loop only if snapshots incomplete

### P1 — Sargable date filters
- Replaced `whereDate(...)` with `opened_at/closed_at >= startOfDay` / `< nextDay` OR window (same calendar-day intent)

### P2 — Sort helper index
- Postgres expression index on `COALESCE(closed_at, opened_at) DESC`

### Routes marked
`routes/api.php`:
- `GET /admin/reports/profit-loss` tagged (no logic change)
- `GET /ecommerce/reports/cash-shifts` + `/summary` tagged  
`// NEW ENHANCEMENT — profit-loss-cash-shifts-query-v1`

---

## Deploy notes
1. Run migration `2026_09_04_000200_…`
2. Backfill CLOSE snapshots (one-off script or artisan) using linked-open window; orphans = 0  
   Without backfill, period summary falls back to live loop until snapshots exist.

---

## Trade-offs
- Extra decimal column + expression index (small write cost on close)
- Snapshot is point-in-time at close (matches prior live formula at close); voided later orders do not rewrite history (same as freezing at close)
