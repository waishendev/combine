# History + My Leave + Staff Consumable Logs — Query Enhancement ANALYSIS (2026-09-05)

Enhancement id: `leave-history-myleave-consumable-logs-query-v1`

**CRM pages**
- `/staff-consumables/history`
- `/booking/my-leave`
- `/logs/staff-consumables`

**Review:** `History_MyLeave_Staff_Consumables_Logs_Query_Performance_Review_2026_09_05.md`  
**Constraint:** Same list fields / summary keys / decide-adjust-leave mutation semantics. ACTION controls still on-page only.

**Environment:** Local Postgres · staff_free_applied=37 · leave_requests(staff#1)=55 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| My-history `limit=50` | ~28 ms / 10 q | **~26–30 ms** / 10–11 q | Folded branch into claim `whereHas` (1 EXISTS) |
| Logs page 1 | ~66 ms / **13** q | **~54 ms** / **11** q | −2 q; one summary aggregate |
| Logs + branch | ~68 ms / 14 q | **~56 ms** / **12** q | No double `whereHas(order)` |
| Logs + search=`a` | ~79 ms / 13 q | **~63 ms** / 11 q | Same match semantics; grouped OR |
| Logs + staff_id | ~43 ms / 13 q | **~29 ms** / 11 q | Same pattern |
| My-leave requests upcoming | ~20 ms | **~19–22 ms** | Sargable `end_date`; new list index |
| My-leave requests all/past | ~42–46 ms | **~33–40 ms** | Index + date compare |
| My-leave balances / options | ~2.5 / ~9 ms | unchanged | Already healthy |

ACTION navigation unchanged (no cross-page Action links).

---

## What landed

### Staff consumable logs + history (`PosController`)
- Optional `$orderScope` on `staffConsumableClaimQuery` — branch / accessible store filters apply **inside** the claim `whereHas(order)` (single EXISTS).
- `adminStaffConsumableLogs`: one `SELECT COUNT(*), SUM(qty), SUM(price)` via `toBase()`; page via `forPage` + `LengthAwarePaginator` (same response keys: `data`, `current_page`, `last_page`, `per_page`, `total`, `summary.*`).
- Search: snapshot/`order_number` group OR relation group — **identical match set**, clearer structure.
- `myStaffConsumableClaims` (history): branch folded the same way.

### My Leave
- `whereDate('end_date')` → `where('end_date', '>='| '<', $today)` (date column; sargable).
- Index: `(staff_id, created_at DESC)` — migration `2026_09_05_000500_add_history_myleave_consumable_logs_query_indexes.php`.
- FE: `PaginationControls` when `last_page > 1` (API already paginated; removes silent truncation past 100 rows).

### Routes tagged
`routes/api.php` — `leave-history-myleave-consumable-logs-query-v1` on staff-consumables logs + my-leave GET block.

---

## Sample SQL (after)

**Logs summary (replaces 2×SUM + COUNT):**
```sql
SELECT COUNT(*) as total_logs,
       COALESCE(SUM(order_items.quantity), 0) as total_qty,
       COALESCE(SUM(<price expr>), 0) as total_price
FROM order_items WHERE … claim+branch EXISTS …
```

**My-leave upcoming:**
```sql
… AND "end_date" >= ? ORDER BY "created_at" DESC LIMIT 100
```
(no `"end_date"::date` cast)

---

## Deploy notes
1. Run migration `2026_09_05_000500_add_history_myleave_consumable_logs_query_indexes`.
2. Smoke `/logs/staff-consumables`: filters, summary cards, pagination, search.
3. Smoke `/staff-consumables/history` with branch switch.
4. Smoke `/booking/my-leave`: upcoming/past/all, pager if >100 rows, Apply/Cancel/day-change modals.

---

## Trade-offs
- Extra index on leave requests: small write cost on inserts/updates.
- My-leave pager is additive UI when totals exceed one page (default still 100/page).
- Claim `notes LIKE '%staff_free_consumable_claim%'` **kept** (needs backfill audit before dropping).

---

## Deferred
- Drop claim notes-LIKE after proving all claims have `payment_method = staff_free`.
- Deeper search rewrite (snapshot-only) — would risk match-semantics change.
