# Booking + Ecommerce Commissions — Query Enhancement (2026-09-04)

Enhancement id: `booking-ecommerce-commissions-query-v1`

**CRM pages**
- `/booking/commissions`
- `/ecommerce/commissions`

**Constraint:** Same list JSON shape, filters, freeze/reopen/override/recalculate flows. Additive staff options permissions only.

**Environment:** Local Postgres · `staff_monthly_sales`=32 · median of 5 where noted.

---

## Verdict

| Change | Result |
|--------|--------|
| FE staff dropdown → `/staffs/options/query` | **~8.5 ms / 4 q / ~0.8 KB** vs old index **~20 ms / 6 q / ~3.7 KB** |
| Month recalculate batches tiers per branch | **1 tier SELECT per branch** (was N per staff row) |
| List indexes `(type, year DESC, month DESC)` + `(type, staff_id, year DESC, month DESC)` | Ready for scale; Seq Scan still OK at n=32 |
| `per_page` capped at 200 | Matches FE max; prevents unbounded pages |

List API wall stays ~**23 ms / 6 q** (already healthy snapshot read).

---

## What landed

### P0 — Slim staff filter dropdown (FE + route ACL)
- `StaffCommissionsTable` now loads `/api/proxy/staffs/options/query?per_page=500&is_active=true`
- Parses paginated `data.data` or flat `data`
- `routes/api.php`: extend options middleware with `booking.commissions.view|booking.commissions.override|ecommerce.reports.sales.view`

### P1 — Batch tier resolution on month recalculate / incremental apply
- `StaffCommissionService::tiersForBranchType()` loads branch+type tiers once (`ORDER BY min_sales DESC`)
- Used by:
  - `recalculateBookingForMonthAll` / `recalculateEcommerceForMonthAll` (per branch before staff loop)
  - `applyCompletedBooking` / `reverseCompletedBooking` (one load per booking branch)
  - Single-staff month paths still pass preloaded or load once
- Same tier rule as before (`recalculateMonthly` already accepted `$preloadedTiers`; tier CUD path already batched)

### P1 — List indexes
Migration `2026_09_04_000100_add_staff_monthly_sales_list_indexes.php`:
- `staff_monthly_sales_type_period_desc_index` on `(type, year DESC, month DESC)`
- `staff_monthly_sales_type_staff_period_index` on `(type, staff_id, year DESC, month DESC)`

### P2 — List `per_page` clamp
- `CommissionController@index`: `min(200, max(1, …))` — default still 20

### Routes marked
`routes/api.php`:
- Staffs options block tagged for this enhancement (+ prior consumables)
- Admin booking commissions block tagged `// NEW ENHANCEMENT — booking-ecommerce-commissions-query-v1`

---

## Benchmark (local, after)

| Path | Wall | Queries | Notes |
|------|-----:|--------:|-------|
| `GET …/commissions?type=BOOKING&per_page=15` | **23 ms** | 6 | Unchanged shape |
| Staff options (new) | **8.5 ms** | 4 | id+name only |
| Staff index (old dropdown) | **20 ms** | 6 | Comparison only |
| `recalculateForMonthAll` BOOKING branch=1 (6 staff) | **~990 ms** | 49 | **tier_q=1** (was 1 per staff) |
| EXPLAIN list `type=BOOKING ORDER BY year,month LIMIT 15` | **0.05 ms** | — | Seq Scan @ 32 rows (indexes present) |

Trade-offs: two extra indexes (small write cost on monthly upserts); options route ACL widened so commission-only roles can load the filter without full `staff.view`.

---

## Not changed
- Commission list response fields / pagination envelope
- Freeze / reopen / override semantics
- Tier threshold matching rules
- `OR store_location_id IS NULL` branch-scope semantics (left intact for unassigned legacy rows)
