# Four Log Pages — Query Performance Review (2026-09-05)

**Scope**

| Page | Client | Primary APIs |
|------|--------|--------------|
| `/customers/points-adjustment-logs` | `CustomerPointsAdjustmentLogsPage` | `GET /api/customer-points-adjustment-logs` |
| `/customers/deposit-waiver-logs` | `CustomerDepositWaiverLogsPage` | `GET /api/customer-deposit-waiver-logs` |
| `/booking/commissions/logs` | `CommissionLogsPage` | `GET /api/admin/booking/commission-logs` + `GET /staffs?per_page=200` |
| `/booking/logs` | `BookingLogsPage` | `GET /api/admin/booking/logs` (+ `export.csv`) |

**Constraint:** Analysis only — no business logic / API / UX changes in this pass.

**Environment:** Local Postgres · points_logs=5 · deposit_waiver_logs=0 · staff_commission_logs=24 · booking_logs=710 · median of 5.

**Parked elsewhere:** `computed_payment_status` (appointment-history) remains deferred.

---

## ACTION / navigation analysis

**None of these four pages navigate to other CRM routes from Action / Actions columns.**

| Page | Control | Behavior | Other page APIs? |
|------|---------|----------|------------------|
| Points adjustment | **Action** badge (`add` / `reduce`) | Display only | No |
| Deposit waiver | **Action Type** badge (`enable` / `disable`) | Display only | No |
| Commission logs | **Action** badge + **View Details** | Local modal (old/new JSON) | No extra fetch / no route |
| Booking logs | **Action** badge + eye icon | Local drawer (meta JSON); Booking ID is **not** a link | No |

No secondary page review required for click-through.

---

## Executive summary

| Call | Wall | Queries | Verdict |
|------|------|---------|---------|
| Points adjustment page 1 | **~7 ms** | 4 | OK locally (5 rows); **Seq Scan** on list sort |
| Deposit waiver page 1 | **~1 ms** | 1 | Empty locally; same structural risk |
| Commission logs page 1 | **~29 ms** | 7 | OK small; missing `created_at` list index |
| Commission logs + keyword | **~33 ms** | 7 | `%LIKE%` + `orWhereHas(staff)` risk at scale |
| Staffs dropdown (heavy) | **~22 ms** | 6 | Prefer `/staffs/options/query` (~7 ms / 4 q) |
| Booking logs page 1 | **~14 ms** | 3 | **Already healthy** (`booking-logs-query-v1`) |

---

## 1) Points adjustment + Deposit waiver logs

### Query shape
```php
Model::with(['customer:id,name,phone', 'createdBy:id,name,username'])
  ->latest('created_at')->paginate($perPage);
```
No filters. Tables: `customer_points_adjustment_logs`, `customer_deposit_waiver_logs`.

### Indexes today
Only `(customer_id, created_at)` — good for per-customer history, **not** for global CRM list `ORDER BY created_at DESC`.

### EXPLAIN (points list LIMIT 20)
```text
Sort → Seq Scan on customer_points_adjustment_logs
Execution Time: ~0.03 ms   (5 rows)
```
Deposit waiver same pattern (Seq Scan + Sort).

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P1** | Index `(created_at DESC)` or `(created_at DESC, id DESC)` on both tables | Matches list sort/paginate | Small write cost |
| P2 | Optional filters (customer, date, action_type) | Avoid full-table growth pain | FE/API additive |
| Low | Already eager-loads relations correctly | No N+1 | — |

---

## 2) Commission logs (`/booking/commissions/logs`)

### Query shape
- `StaffCommissionLog` + eager `staff` / `performer` / `storeLocation`
- Branch scope on `store_location_id`
- Filters: type, staff, year, month, action, from/to (sargable), remarks, **keyword**
- Keyword: `remarks LIKE %x%` OR `action LIKE %X%` OR **`orWhereHas('staff', name LIKE %x%)`**
- Order: `created_at DESC`

### Indexes today
- `(staff_id, type, year, month)`
- `(store_location_id, type, year, month)` — period reports
- `(action)`
- **No** `(store_location_id, created_at DESC)` for default branch list

### EXPLAIN
Default branch list (24 rows): **Seq Scan + Sort** (~0.03 ms).  
Keyword: Hash Left Join staffs + filter `~~* '%a%'` — fine tiny; will degrade when logs grow.

### Staff dropdown
FE calls `/staffs?per_page=200&is_active=true` (~22 ms / 6 q; backend caps per_page at 50).  
Slim `/staffs/options/query` is ~7 ms / 4 q and already used on commissions **list** pages.

### Recommendations

| Priority | Change | Why | Trade-off |
|----------|--------|-----|-----------|
| **P0** | FE staff filter → `/staffs/options/query` | Cuts mount cost; same dropdown UX | None material |
| **P1** | Index `(store_location_id, created_at DESC)` | Default list + branch scope | Write/storage |
| **P1** | Keyword: join/`whereIn` staff ids instead of `orWhereHas`, or require prefix search | Avoid correlated EXISTS + leading `%` | Slight query rewrite; same results if careful |
| P2 | Optional `(created_at DESC)` alone | Unscoped admin views | — |

**Not covered by** `booking-ecommerce-commissions-query-v1` (that targeted commission **list** pages, not logs).

---

## 3) Booking audit logs (`/booking/logs`)

### Status
Already enhanced as **`booking-logs-query-v1`**: batched `actor_name`, indexes `(created_at DESC, id DESC)` / action composite / booking_id partial, CSV streams via `cursor()`.

### EXPLAIN
```text
Index Only Scan booking_logs_created_at_id_desc_idx
Execution Time: ~0.10 ms
```

### Residual notes (low)
- CSV export can stream **all** matching rows if filters are empty — correct but heavy on huge tables (operational caution, not a list bug).
- FE only exposes `action` filter; API also supports from/to/booking_id/actor_* (unused — opportunity, not a perf defect).
- Page SSR has no permission gate (relies on API/sidebar) — security note, not query perf.

### Recommendations
**No P0.** Optional P2: document export volume limits / require date range for export.

---

## Suggested implementation order (future Enhancement)

1. Commission logs: staff options FE + `(store_location_id, created_at DESC)` + keyword fold.
2. Points + deposit waiver: `(created_at DESC)` indexes.
3. Leave booking logs as-is unless export abuse appears.

---

## Appendix — bench

```text
php storage/app/_bench_four_logs.php
```
