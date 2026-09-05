# Leave Pages — Query Enhancement ANALYSIS (2026-09-05)

Enhancement id: `leave-pages-query-v1`

**CRM pages**
- `/booking/leave-requests`
- `/booking/leave-balances`
- `/booking/leave-logs`

**Review:** `Leave_Pages_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / list response shape / decide-adjust semantics / ACTION navigation changes.

**Environment:** Local Postgres · leave_requests=364 · leave_balances=7 · leave_logs=418 · staffs=12 · pending=0 · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| Leave requests pending page 1 | ~9–12 ms / 3–4 q | **~5–6 ms** / 3–4 q | Index on pending+branch sort |
| Leave balances ALL | ~26–28 ms / 6–7 q | **~17–20 ms** / 6–7 q | Usage **Index Only Scan** |
| Leave logs page 1 | ~73 ms / 8–9 q | **~50–52 ms** / 8–9 q | Same SQL shape; quieter wall |
| Staff dropdown (was leave-balances) | **~26 ms / 6 q** | **~7–9 ms / 4–5 q** | Slim `/staffs/options/query` |
| Pending list SQL | Sort + status index | **Index Scan** `leave_requests_branch_status_created_at_desc_idx` | No Sort |
| Balances usage SUM | Seq Scan (361 filtered) | **Index Only Scan** INCLUDE(days) | Scale-ready |
| Logs staff+action | Bitmap old index + Sort | Bitmap **`leave_logs_staff_action_created_at_desc_idx`** | Covering sort key |

ACTION controls unchanged: Approve/Reject / ADD/REDUCE stay on-page; logs eye = local drawer.

---

## What landed

### FE — staff filter dropdown
- `BookingLeaveRequestsPage` + `BookingLeaveLogsPage` → `GET /staffs/options/query?per_page=500&include_inactive=1&require_store_location=1` (+ `branch_store_location_id` when branch selected).
- Maps `{id,name}` → `{staff_id,staff_name}` for existing UI.
- **Leave balances page** still uses full `GET leave-balances` (needs entitlements + usage).
- **Leave calendar** still uses leave-balances (needs `store_locations` for off-day branch pickers) — out of this page trio.

### Backend — staff options (additive flags)
- `include_inactive=1` — skip active-only filter (matches prior leave-balances staff set).
- `require_store_location=1` — always require accessible branch assignment (even platform bypass), matching leave-balances.
- Default behavior for other callers unchanged (`is_active=true`, bypass may omit location filter).
- Permissions extended: `booking.schedules.view` \| `booking.leave.logs.view`.

### Indexes
Migration: `2026_09_05_000400_add_leave_pages_query_indexes.php`

| Index | Table |
|-------|--------|
| `(store_location_id, status, created_at DESC)` | `booking_leave_requests` |
| `(staff_id, status, leave_type) INCLUDE (days)` (PG) | `booking_leave_requests` |
| `(staff_id, action_type, created_at DESC)` | `booking_leave_logs` |

### Routes tagged
`routes/api.php` — `leave-pages-query-v1` on leave-requests / balances / logs block + staffs/options/query comment/permissions.

---

## EXPLAIN highlights (after)

**Pending + branch list**
```text
Index Scan using leave_requests_branch_status_created_at_desc_idx
Execution Time: ~0.03 ms
```

**Balances usage SUM**
```text
Index Only Scan using leave_requests_staff_status_leave_type_idx
Execution Time: ~0.07 ms
```

**Logs staff + action**
```text
Bitmap Index Scan on leave_logs_staff_action_created_at_desc_idx
Execution Time: ~0.06 ms
```

---

## Deploy notes
1. Run migration `2026_09_05_000400_add_leave_pages_query_indexes`.
2. Smoke leave-requests: staff filter + Approve/Reject modal.
3. Smoke leave-logs: staff/action/date filters + eye drawer (users with only `booking.leave.logs.view` must load staff options).
4. Smoke leave-balances: ADD/REDUCE still works (unchanged API).
5. Deploy FE + API together so leave-log viewers have the new options permissions.

---

## Trade-offs
- Extra indexes: small write cost on leave request status changes and leave log inserts.
- Staff options max 500 names (same pattern as other CRM dropdowns); leave-balances previously returned unbounded staff rows with balances payload.
- Leave calendar still over-fetches leave-balances for staff+branches (intentional — needs branch list for creation forms).

---

## Deferred (unchanged)
- Server pagination for leave-balances list.
- Denormalize `store_location_id` onto `booking_leave_logs`.
- Slim leave-log list JSON (drop before/after until detail).
