# Appointment Activity Logs + CSP — Query Enhancement ANALYSIS (2026-09-05)

Enhancement id: `appt-activity-logs-csp-query-v1`

**CRM pages**
- `/appointments/activity-logs`
- `/booking/customer-service-packages`

**Review:** `Appt_Activity_Logs_CSP_Query_Performance_Review_2026_09_05.md`  
**Constraint:** Same row fields for lists; CSP usages gains additive pagination meta. No ACTION navigation changes (none existed).

**Environment:** Local Postgres · activity_logs=8,933 (Booking=4,455) · customers=661 · CSP near-empty · median of 5.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| Appt logs page 1 | ~17 ms / 5 q | **~18 ms / 5 q** | Slimmer SELECT; indexes for scale |
| Appt logs list SQL select | `old_values`, `ip_address`, … | **Dropped unused cols** | Less jsonb I/O |
| Customers dropdown | **~60–68 ms / 6 q** (`/customers?per_page=100`) | **~60 ms / 2 q** (`/customers/options/query?per_page=500`) | **−4 q**; no loyalty batch |
| CSP `index` | ~5 ms / 3 q | **~3 ms / 2 q** | Slim `with` |
| CSP `balances` | whereHas | **whereIn package ids** | Folded subquery |
| CSP `usages` | unbounded `get()` | **paginate 50** + FE pager | Caps payload growth |
| `availableFor` (POS, same controller) | N× reserved SUM | **1 grouped SUM** | −N+1 |

Local CSP usage volume is still ~0 — pagination / index wins show up when usage history grows.

---

## What landed

### Appointment activity logs
- Slim `appointmentIndex` SELECT (keep `new_values` only for `booking_number`; drop `old_values` / `ip_address` from list query).
- Indexes:
  - `activity_logs (model_type, created_at DESC)`
  - `activity_logs (model_type, action, created_at DESC)`
- Migration: `2026_09_05_000300_add_appt_activity_logs_csp_query_indexes.php`

### Customer service packages
- `GET /customers/options/query` — id/name/phone/email, active-only by default, paginated; FE switched from heavy `/customers`.
- `index`: `with(['servicePackage:id,name'])` only.
- `balances`: resolve package ids then `whereIn` (no `whereHas`).
- `usages`: paginate (`per_page` default 50, max 100); response `{ data: rows, current_page, last_page, per_page, total }` under API `data`.
- FE: usage Previous/Next when `last_page > 1`.
- `availableFor`: batch reserved qty (bonus, same controller).
- Index: `customer_service_package_usages (customer_id, id DESC)`.

### Routes tagged
`routes/api.php` — `appt-activity-logs-csp-query-v1` on appointment-activity-logs, customers/options/query, CSP balances/usages.

---

## Deploy notes
1. Run migration `2026_09_05_000300_add_appt_activity_logs_csp_query_indexes`.
2. Smoke `/appointments/activity-logs` filters + pagination.
3. Smoke CSP: customer dropdown (needs `customer-service-packages.view` or customers.view), packages/balances/usages pager.
4. POS package apply still uses `availableFor` — spot-check reserved qty.

---

## Trade-offs
- Usages no longer returns the entire history in one response (default 50/page). Totals remain accurate via `total`.
- Options dropdown can load up to 500 active customers (vs 100 full customer records) — lighter rows, more names available.
- Activity-log list no longer hydrates `old_values`/`ip_address` (UI never showed them).

---

## Related
- Parked: appointment-history `computed_payment_status` plan (not part of this enhancement).
