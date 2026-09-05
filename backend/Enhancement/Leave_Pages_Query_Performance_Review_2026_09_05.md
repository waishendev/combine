# Leave Pages — Query Performance Review (2026-09-05)

**Scope** (user listed leave-requests twice; **3 unique pages**)

| Page | Client | Primary APIs |
|------|--------|--------------|
| `/booking/leave-requests` | `BookingLeaveRequestsPage` | `GET /admin/booking/leave-requests` (+ `leave-balances` for staff filter) · `PATCH …/decision` |
| `/booking/leave-balances` | `BookingLeaveBalancesPage` | `GET /admin/booking/leave-balances` · `PATCH …/adjust` |
| `/booking/leave-logs` | `BookingLeaveLogsPage` | `GET /admin/booking/leave-logs` (+ `leave-balances` for staff filter) |

**Constraint:** Analysis only — no business logic / API / UX changes in this pass.

**Environment:** Local Postgres · leave_requests=364 · leave_balances=7 · leave_logs=418 · staffs=12 · pending=0 · median of 5.

---

## ACTION / navigation analysis

**None of these three pages navigate to other CRM routes from Action columns.** No secondary page APIs need review for click-through.

| Page | Control | Behavior | Extra API? | Other CRM page? |
|------|---------|----------|------------|-----------------|
| Leave Requests | Approve / Review / Reject | `CrmFormModalShell` → confirm | `PATCH leave-requests/{id}/decision` then reload list | **No** |
| Leave Balances | ADD / REDUCE | Adjust modal | `PATCH leave-balances/{staffId}/adjust` then reload | **No** |
| Leave Logs | Eye | Inline details drawer (`before_value` / `after_value` already on row) | **None** | **No** (`leave_request_id` is plain text, not a link) |

**Related (not ACTION navigation):** Leave Calendar embeds Leave Requests UI in a modal and GETs pending count (`per_page=1`) — still no route push.

Unauthorized on requests/balances → `/dashboard` only.

---

## Executive summary

| Call | Wall | Queries | Verdict |
|------|------|---------|---------|
| Leave requests `status=pending` page 1 | **~9–12 ms** | 3–4 | OK locally (0 pending); structural index gap for list sort |
| Leave requests all statuses page 1 | **~40 ms** | 8 | Eager OK (no N+1); **Seq Scan + Sort** on `created_at` |
| Leave balances ALL / branch | **~26–28 ms** | 6–7 | OK at 12 staff; **unbounded `get()`** + usage Seq Scan risk |
| Leave logs page 1 ALL / branch | **~73 ms** | 8–9 | SQL ~0.5 ms; wall dominated by PHP/access; `whereHas` branch filter |
| Leave logs + date range | **~80 ms** | 8 | Same shape; date filters already sargable |
| Staff filter dropdown (requests + logs) | **~26 ms** | 6 | Over-fetches **full balances + usage** for names only |

---

## 1) Leave Requests (`/booking/leave-requests`)

### Query shape
```php
BookingLeaveRequest::with([
  'staff:id,name', 'storeLocation:id,name', 'reviewer:id,name',
  'creationLog.creator:id,name', 'sourceLeaveRequest:…',
])->/* LeaveBranchService::scopeVisible */
 ->when status/staff_id/leave_type/from_date/to_date
 ->orderByDesc('created_at')->paginate($perPage);
```
UI hardcodes `status=pending`. Staff dropdown separately calls **full** `GET leave-balances`.

### Indexes today
| Index | Purpose |
|-------|---------|
| `(staff_id, status)` | Per-staff status |
| `(start_date, end_date)` | Overlap / calendar |
| `leave_branch_dates_idx` `(store_location_id, start_date, end_date)` | Branch + date range |
| **Missing** for this page | `(status, created_at DESC)` or `(store_location_id, status, created_at DESC)` |

### EXPLAIN
**Pending + branch** (empty locally): Index Scan on `(staff_id, status)` with `status=pending`, then Sort by `created_at` — Execution ~0.1 ms.

**List without status** (page-like ALL):
```text
Limit → Sort (created_at DESC) → Seq Scan on booking_leave_requests
  Filter: store_location_id IN (…) OR NULL
Execution Time: ~0.18 ms   (364 rows)
```

### Eager / N+1
With rows: 8 queries — count, page, staff, store, reviewer, **one** `booking_leave_logs` for `creationLog` (`action_type=created` + `leave_request_id IN (…)`) — **no N+1**.

### ACTION `decide`
Transactional approve/reject (timeoff + leave log). Not a list hotspot; legacy rows with `store_location_id IS NULL` abort 403 by design.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Index `(store_location_id, status, created_at DESC)` | Matches branch + pending list + sort/paginate | Small write cost on request inserts/updates |
| **P1** | Staff filter → slim staff options (e.g. `/staffs/options/query` or balances payload without usage) | Avoid ~26 ms full balances for a dropdown | FE-only; keep balances API for balances page |
| P2 | Prefer `where('end_date','>=',$from)` over `whereDate(...)` if range filters used | Sargable for `leave_branch_dates_idx` | Unused by this page today |
| Low | Eager already correct | — | — |

---

## 2) Leave Balances (`/booking/leave-balances`)

### Query shape
1. `Staff` + `whereHas(storeLocations)` (+ optional branch) → **`get()` all**
2. `BookingLeaveBalance::whereIn(staff_id)` 
3. Approved usage: `SUM(days) GROUP BY staff_id, leave_type` for annual/mc/emergency
4. PHP maps entitled / used / remaining

**No server pagination.** FE filters + slices client-side. Balances are **global per staff**; branch only filters which staff appear.

### Indexes today
- UNIQUE `(staff_id, leave_type)` on balances — good for adjust/upsert
- Usage query relies on `(staff_id, status)` partially; planner still **Seq Scan** at 364 rows

### EXPLAIN (usage aggregate)
```text
GroupAggregate → Sort → Seq Scan booking_leave_requests
  Filter: status=approved AND leave_type IN (…) [AND staff_id IN …]
  Rows Removed by Filter: 361
Execution Time: ~0.08–0.12 ms
```

### ACTION ADD / REDUCE
`updateOrCreate` on unique `(staff_id, leave_type)` + leave log `action_type=adjusted` — PK/unique path; fine.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Index `(status, leave_type, staff_id)` or `(staff_id, status, leave_type)` **INCLUDE (days)** if PG | Speeds usage `SUM` as approved leave grows | Write cost on request status changes |
| **P2** | Server `paginate` / slim columns (optional additive API) | Bounds payload as staff grows | FE must adopt; don’t change default response until FE ready |
| Low | Skip computing `unpaid` in map if UI never shows it | Tiny CPU | Response shape change — **avoid** unless FE agreed |
| — | Do **not** change adjust semantics | Stable production | — |

At ~dozen staff this endpoint is acceptable; risk is **linear staff growth** + full approved-leave scan for usage.

---

## 3) Leave Logs (`/booking/leave-logs`)

### Query shape
```php
BookingLeaveLog::with(['staff','creator','leaveRequest.storeLocation'])
  // branch: whereHas(leaveRequest, scopeVisible)
  // ALL: leave_request_id IS NULL OR whereHas(visible leave)
  -> staff_id / action_type / created_at range / leave_request_id
  ->orderByDesc('created_at')->paginate;
```

### Indexes today
| Index | Fit |
|-------|-----|
| `created_at` | **Good** for default list (Index Scan Backward) |
| `(staff_id, action_type)` | Filter OK; still Sort by `created_at` |
| FK `leave_request_id` | Supports `whereHas` / IN |

### EXPLAIN
**ALL visibility + order:** Index Scan Backward on `created_at` + filter; hashed subplan of visible leave request IDs — Execution ~0.2 ms.

**Branch equivalent:** Nested Loop: walk `created_at` index → PK lookup leave_request + `store_location_id` filter — Execution ~0.1 ms locally.

**staff + action:** Bitmap Index `(staff_id, action_type)` → Sort `created_at` — ~0.06 ms.

Controller wall ~**73 ms** / 8–9 queries — most time outside the hot SQL (auth / accessible stores / Eloquent hydration of JSON columns).

### ACTION eye
Client-only drawer — **no extra query**, no navigation.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Staff filter → slim options (same as requests) | Stops loading balances+usage on every logs mount | FE-only |
| **P2** | Index `(staff_id, action_type, created_at DESC)` | Avoid Sort when filtering staff+action | Moderate write cost |
| P3 | Optional denormalize `store_location_id` onto `booking_leave_logs` | Drop `whereHas` for branch list | Schema + backfill + write path sync; higher risk |
| Low | Slim SELECT (defer large JSON until detail) | Smaller list payload | **Would change** list payload unless additive field — only if FE stops needing JSON in table |

Default list already has a usable `created_at` index — healthier than points/deposit-waiver log pages reviewed earlier.

---

## Cross-cutting: staff dropdown over-fetch

Leave **Requests** and **Leave Logs** both call:

`GET /admin/booking/leave-balances?store_location_id=…` or `accessible_union=1`

Controller **ignores** `accessible_union` and always returns full staff + entitlements + **usage aggregation**. Dropdown only needs `staff_id` / `staff_name`.

Same class of issue as commission logs using heavy `/staffs` — prefer `/staffs/options/query` (already used on appointment-history) **or** a dedicated slim leave-staff options endpoint. Lowest risk: FE switch to existing slim staff options if branch visibility matches product rules.

---

## Safe optimization priority (when implementing)

1. **FE:** Replace leave-balances staff dropdown fetch on requests + logs with slim staff options (behavior-preserving if staff set matches).
2. **DB:** `(store_location_id, status, created_at DESC)` on `booking_leave_requests`.
3. **DB:** `(staff_id, status, leave_type)` [+ INCLUDE days] for balances usage SUM.
4. **DB (optional):** `(staff_id, action_type, created_at DESC)` on `booking_leave_logs`.
5. **Defer:** paginating balances API, denormalizing branch onto leave logs, changing list JSON shape.

---

## Out of scope / not broken

- No N+1 on the three list endpoints (eager / batch `whereIn`).
- Leave logs `created_at` range already uses Carbon start/end of day (sargable) — better than `whereDate`.
- Booking leave calendar / off-day generators are separate surfaces (not these three pages’ ACTION targets).
