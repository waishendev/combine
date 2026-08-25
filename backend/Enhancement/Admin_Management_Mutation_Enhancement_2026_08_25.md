# Admin Management Mutation Enhancement (2026-08-25)

Enhancement id: `admin-management-mutation-v1`

## New APIs

| Method | Path | Use |
|--------|------|-----|
| POST | `/api/admins/query` | Slim create (no `staff`) |
| GET | `/api/admins/{admin}/query` | Slim show for edit modal |
| PUT | `/api/admins/{admin}/query` | Slim update |
| DELETE | `/api/admins/{admin}/query` | Destroy (same semantics) |
| POST | `/api/roles/query` | Slim create (`permissions_count`, no nested perms) |
| GET | `/api/roles/{role}/edit/query` | Slim edit payload (role + assigned perms only; **no** catalog) |
| PUT | `/api/roles/{role}/query` | Slim update |
| DELETE | `/api/roles/{role}/query` | Destroy (same semantics) |
| POST | `/api/permission-groups/{group}/move-up/query` | Move + `{moved,swapped}` for local UI reorder |
| POST | `/api/permission-groups/{group}/move-down/query` | Move + `{moved,swapped}` for local UI reorder |

Marked in `routes/api.php` inside `// NEW ENHANCEMENT` … `// END NEW ENHANCEMENT`. Legacy mutation routes kept as `// OLD QUERY`.

## What landed

- Role edit no longer returns full `delegatable_permissions` (catalog already from `/permissions/delegatable/query`)
- Role store/update return slim row with `permissions_count` instead of nested permission arrays
- Admin show/store/update skip `staff` relation
- Permission-group move returns neighbor ids/sort_orders so CRM can local-swap **without** list refetch
- Permissions / permission-group CUD left on legacy paths (already lean; no nested catalog bloat)

## CRM wire

- `RoleCreateModal` / `RoleEditModal` → `/roles/query`, `/roles/{id}/edit/query`, `/roles/{id}/query`
- `AdminCreateModal` / `AdminEditModal` / deletes → `/admins/.../query`
- `PermissionGroupTable` move-up/down → `.../move-*/query` + local reorder

## Benchmark (local · median of 5 · superadmin)

| Call / UX path | Before | After | Delta |
|----------------|--------|-------|-------|
| **Role edit open** wall | 74 ms | **26 ms** | **−64%** |
| Role edit payload | 31.1 KB | **1.9 KB** | **−94%** |
| Admin show (edit) payload | 1.1 KB | **0.4 KB** | **−66%** |
| Admin show wall | ~77 ms | ~76 ms | ~flat |
| **Move-up UX** (move + list refetch vs move only) wall | 43 ms | **20 ms** | **−52%** |
| Move-up UX bytes transferred | 7.9 KB | **0.2 KB** | **−97%** |

## Controller

`App\Http\Controllers\AdminManagementMutationEnhancementController`
