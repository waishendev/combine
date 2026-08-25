# Admin Management Query Enhancement (2026-08-25)

Enhancement id: `admin-management-query-v1`

## New APIs

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/admins/overview` | Optional first paint (admins + slim roles) |
| GET | `/api/admins/query` | CRM `/admins` list + server filters |
| GET | `/api/roles/overview` | CRM `/roles` first paint (slim) |
| GET | `/api/roles/query` | CRM `/roles` pagination / filters (slim) |
| GET | `/api/permissions/overview` | CRM `/permission` first paint |
| GET | `/api/permissions/query` | CRM `/permission` pagination (`group_id` honored) |
| GET | `/api/permissions/delegatable/query` | Role create/edit slim catalog |
| GET | `/api/permission-groups/query` | CRM `/permission-groups` (no nested perms by default) |

Marked in `routes/api.php` between `// NEW ENHANCEMENT` … `// END NEW ENHANCEMENT`. Legacy GETs kept as `// OLD QUERY`.

## What landed

### P0 — Indexes
- `role_user (user_id)`
- `permission_role (role_id)`
- `permission_groups (sort_order)`
- `roles (is_system)`

### P1 — Request memo
- `User::{getAllPermissions,isSuperAdmin,canManageSystemAdmins,delegatablePermissions}`
- `StoreLocationAccessService::hasPlatformBypass`

### P2 — Slim list assembly + CRM wire
- Roles list uses `withCount('permissions')` (no nested permission rows)
- Permission-groups list skips nested permissions by default
- Delegatable returns `{id,name,slug,group_id}` only
- Admins honor `username` / `email` / `role_id` / `is_active` server-side
- Permissions honor `group_id`
- Role permission side panel lazy-loads `GET /roles/{id}`

## Benchmark (local · median of 5 · superadmin)

| Page / call | Before | After | Delta |
|-------------|--------|-------|-------|
| **/roles** wall | 298 ms | **129 ms** | **−57%** |
| /roles payload | 56.4 KB | **1.6 KB** | **−97%** |
| /roles queries | 9 | 8 | −1 |
| **/permission-groups** wall | 167 ms | **32 ms** | **−81%** |
| /permission-groups payload | 48.2 KB | **8.0 KB** | **−84%** |
| /permission-groups queries | 3 | 2 | −1 |
| /permission (combined) wall | 92 ms | 82 ms | −10% |
| /permission payload | 22.8 KB | 21.1 KB | −7% |
| /admins wall | 170 ms | 187 ms | ~flat (already slim) |
| /admins queries | 11 | 11 | — |

## Controller

`App\Http\Controllers\AdminManagementQueryEnhancementController`
