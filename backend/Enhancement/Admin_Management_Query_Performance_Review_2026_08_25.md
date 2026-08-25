# Admin Management Pages — Query Performance Review (2026-08-25)

**Scope:** CRM `/admins`, `/roles`, `/permission`, `/permission-groups`  
**Constraint:** Analysis only — no business logic / API / response / UX changes.  
**Environment:** Local Postgres · 10 users · 11 roles · 213 permissions · 50 groups · 897 `permission_role` · superadmin

## Page → first-paint APIs

| Page | Calls |
|------|--------|
| `/admins` | `GET /admins?page&per_page=50&branch…` + `GET /roles?per_page=200&is_active&showPermission=false` (+ optional `/me/store-locations`) |
| `/roles` | `GET /roles?page&per_page=50&branch…` (**default `showPermission=true`**) + `GET /permissions/delegatable` |
| `/permission` | `GET /permissions?page&per_page=50` + `GET /permission-groups?per_page=200&showPermission=false` |
| `/permission-groups` | `GET /permission-groups?page&per_page=50` (**default `showPermission=true`**) |

## Measured first paint (Laravel query log)

| Scenario | Wall | SQL | Queries | Payload |
|----------|------|-----|---------|---------|
| Admins page (admins + roles dropdown) | 345 ms | 38 ms | **23** | 16 KB |
| Roles page (roles + delegatable) | 278 ms | 12 ms | 11 | **98 KB** |
| Roles list `showPermission=false` only | 79 ms | 9 ms | 8 | **3 KB** |
| Permissions page (perms + groups dropdown) | 60 ms | 4 ms | 5 | 23 KB |
| Permission-groups default (with nested perms) | 107 ms | 3 ms | 3 | **48 KB** |
| Permission-groups `showPermission=false` | 18 ms | 1 ms | 2 | **7 KB** |

Local SQL ms look small; **payload bloat + auth graph queries + missing pivot indexes** dominate at scale.

## Findings

### 1. Roles list defaults to full nested permissions (highest impact)

`RoleController::index` defaults `showPermission=true`. CRM `RoleTable` does **not** pass `false` (unlike `AdminTable` dropdown).

**Effect:** list page embeds every permission row per role → **~98 KB** vs **~3 KB** without. UI only needs a short preview / count.

**Root cause:** default API flag + CRM omit.

**Safe recommendations**
| Change | Trade-off |
|--------|-----------|
| CRM pass `showPermission=false` on list; load permissions on edit/view panel only | Behavior-compatible if panel already hits `/roles/{id}/edit` |
| Or new slim list API | Prefer when doing enhancement wave |

### 2. Permission-groups list defaults to nested permissions

Same pattern: default `showPermission=true`; list UI shows name + sort_order only.

**Effect:** **48 KB → 7 KB** with `showPermission=false`.

### 3. Roles page always loads full `delegatable` catalog

`GET /permissions/delegatable` on first paint (even before Create). Superadmin → `Permission::all()` (213 rows).

**Recommend:** lazy-load when opening create/edit modal (UX change timing only; same endpoint). Or slim `{id,slug,name,group_id}` endpoint later.

### 4. Repeated permission-graph auth on admins / roles

`canManageSystemAdmins()` / `getAllPermissions()` / `hasPlatformBypass()` load roles + branchRoles + permissions pivots **per request**, often multiple times.

Admins first paint: **23 queries**, including multiple `permission_role` joins for actor gates.

**Recommend (safe):** request-memoize actor permission slug set / platform bypass boolean (same responses).

### 5. Missing secondary indexes on pivots

| Table | Existing | Gap |
|-------|----------|-----|
| `role_user` | PK `(role_id, user_id)` | No leading `user_id` index → User→roles / EXISTS-by-user |
| `permission_role` | PK `(permission_id, role_id)` | No leading `role_id` index → Role→permissions (EXPLAIN: **Seq Scan** on 897 rows) |
| `permission_groups` | PK | No `sort_order` index (list + move neighbor) |
| `roles` | `(store_location_id, is_active)`, unique name | No `is_system` helper index |

**EXPLAIN:** `permission_role` lookup by `role_id` → Seq Scan + Hash Semi Join.

**P0 indexes (no behavior change)**
```sql
CREATE INDEX role_user_user_id_idx ON role_user (user_id);
CREATE INDEX permission_role_role_id_idx ON permission_role (role_id);
CREATE INDEX permission_groups_sort_order_idx ON permission_groups (sort_order);
-- optional
CREATE INDEX roles_is_system_idx ON roles (is_system);
```

Trade-off: small storage; slightly slower role/permission attach writes.

### 6. Non-sargable / unused filters

| Pattern | Where |
|---------|--------|
| `LOWER(name) <> 'all branches'` | Every `accessibleStoreLocations` |
| `LIKE '%…%'` | Admin search; role/permission/group name filters |
| CRM sends `username`/`email`/`role_id`/`is_active` on `/admins` | Backend only honors `search` + branch — **client-side filter after fetch** |

### 7. N+1

List endpoints eager-load relations — **no classic N+1** on page rows. Cost is eager **over-fetch** + auth graph + COUNT+page.

### 8. Permissions page

Mostly healthy (paginate + `with('group')` + slim groups dropdown). Note: CRM sends `group_id` but API filters `group` — group filter server-side ineffective (UI may filter client-side).

## EXPLAIN ANALYZE (local highlights)

| Query | Plan |
|-------|------|
| Admins branch EXISTS | Hash Semi Join; Seq Scan users (tiny) |
| `permission_role` by role_id | **Seq Scan permission_role** (897 rows) |
| `permission_groups ORDER BY sort_order` | Sort (no index) |
| `permissions name LIKE '%view%'` | Seq Scan (expected) |
| `store_locations LOWER(name)` | Seq Scan + Filter |

## Priority (safe)

1. **P0 indexes** on `role_user(user_id)`, `permission_role(role_id)`, `permission_groups(sort_order)`
2. **P1** CRM / slim list: `showPermission=false` on roles + permission-groups lists; lazy `delegatable`
3. **P1** Request-memo actor permission / bypass checks
4. **P2** Later: combined overview APIs; fix admins filter query params; replace `LOWER(name)` with structured flag for “all branches” row

## What not to do

- Do not change soft-delete / branch / system-role authorization rules.
- Do not drop nested `permissions` from default API without CRM coordination (or new query endpoints).
- Do not add Redis caching of ACL without explicit product acceptance.
