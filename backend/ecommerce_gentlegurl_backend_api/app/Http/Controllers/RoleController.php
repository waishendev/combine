<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $query = Role::where('is_system', false);
    
        // ✅ 只有在有 pass is_active 的时候才过滤
        if ($request->has('is_active')) {
            $query->where(
                'is_active',
                $request->boolean('is_active')
            );
        }
    
        // Filter by name
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->input('name') . '%');
        }
    
        // Load permissions only if showPermission = true
        if ($request->boolean('showPermission', true)) {
            $query->with('permissions');
        }
    
        return $this->respond(
            $query->paginate($request->integer('per_page', 15))
        );
    }

    // public function indexAll(Request $request)
    // {
    //     $query = Role::query();

    //     if ($request->has('is_active')) {
    //         $query->where(
    //             'is_active',
    //             $request->boolean('is_active')
    //         );
    //     }

    //     if ($request->filled('name')) {
    //         $query->where('name', 'like', '%' . $request->input('name') . '%');
    //     }

    //     if ($request->boolean('showPermission', true)) {
    //         $query->with('permissions');
    //     }

    //     return $this->respond(
    //         $query->paginate($request->integer('per_page', 15))
    //     );
    // }
    

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:roles,name'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role = new Role([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);
        $role->is_system = false;
        $role->save();

        $requested = $this->requestedPermissionIdentifiers($request);
        $delegatable = $request->user()->delegatablePermissions();

        if ($requested->isNotEmpty()) {
            $errorResponse = $this->validateDelegatablePermissions($requested, $delegatable);
            if ($errorResponse) {
                return $errorResponse;
            }
        }

        $role->permissions()->sync(
            $this->resolvePermissionIds($requested, $delegatable)
        );

        return $this->respond($role->load('permissions'), __('Role created successfully.'));
    }

    public function show(Request $request, Role $role)
    {
        $this->ensureNotSystemRole($role, $request->user(), true);

        return $this->respond($role->load('permissions'));
    }

    public function edit(Request $request, Role $role)
    {
        $this->ensureNotSystemRole($role, $request->user(), true);

        $user = $request->user();
        $delegatable = $user->delegatablePermissions();
        $role->load('permissions');

        if (! $user->isSuperAdmin()) {
            $delegatableIds = $delegatable->pluck('id')->all();
            $role->setRelation(
                'permissions',
                $role->permissions->whereIn('id', $delegatableIds)->values()
            );
        }

        return $this->respond([
            'role' => $role,
            'delegatable_permissions' => $delegatable->values(),
        ]);
    }

    public function update(Request $request, Role $role)
    {
        $this->ensureNotSystemRole($role, $request->user(), true);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->fill($validated);
        $role->save();

        if ($request->has('permissions') || $request->has('permission_ids')) {
            $requested = $this->requestedPermissionIdentifiers($request);
            $delegatable = $request->user()->delegatablePermissions();

            if ($requested->isNotEmpty()) {
                $errorResponse = $this->validateDelegatablePermissions($requested, $delegatable);
                if ($errorResponse) {
                    return $errorResponse;
                }
            }

            $delegatableSlugs = $delegatable->pluck('slug')->all();
            $currentSlugs = $role->permissions()->pluck('slug')->all();
            $requestedSlugs = $this->resolvePermissions($requested, $delegatable)
                ->pluck('slug')
                ->all();

            $unchanged = array_diff($currentSlugs, $delegatableSlugs);
            $next = array_values(array_unique(array_merge(
                $unchanged,
                array_intersect($requestedSlugs, $delegatableSlugs)
            )));

            $role->permissions()->sync(
                Permission::query()
                    ->whereIn('slug', $next)
                    ->pluck('id')
                    ->all()
            );
        }

        return $this->respond($role->load('permissions'), __('Role updated successfully.'));
    }

    public function destroy(Role $role)
    {
        $this->ensureNotSystemRole($role);

        $role->delete();

        return $this->respond(null, __('Role deleted successfully.'));
    }

    private function ensureNotSystemRole(Role $role, ?User $user = null, bool $allowSuperAdmin = false): void
    {
        if ($role->is_system) {
            if ($allowSuperAdmin && $user && $user->isSuperAdmin()) {
                return;
            }
            abort(404);
        }
    }

    private function requestedPermissionIdentifiers(Request $request): Collection
    {
        $requested = collect($request->input('permissions', []))
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn ($value) => trim($value))
            ->unique()
            ->values();

        $permissionIds = collect($request->input('permission_ids', []))
            ->filter(fn ($value) => $value !== null && $value !== '');

        if ($permissionIds->isNotEmpty()) {
            $requested = $requested
                ->merge(
                    Permission::query()
                        ->whereIn('id', $permissionIds)
                        ->pluck('slug')
                )
                ->unique()
                ->values();
        }

        return $requested;
    }

    private function validateDelegatablePermissions(Collection $requested, Collection $delegatable)
    {
        $allowedIdentifiers = $delegatable
            ->pluck('slug')
            ->merge($delegatable->pluck('name'))
            ->filter()
            ->unique()
            ->values();

        $diff = $requested->diff($allowedIdentifiers);

        if ($diff->isNotEmpty()) {
            return response()->json([
                'message' => 'You are not allowed to assign these permissions.',
                'errors' => [
                    'permissions' => $diff->values()->all(),
                ],
            ], 403);
        }

        return null;
    }

    private function resolvePermissions(Collection $requested, Collection $delegatable): Collection
    {
        if ($requested->isEmpty()) {
            return collect();
        }

        $allowedIds = $delegatable->pluck('id')->all();

        return Permission::query()
            ->where(function ($query) use ($requested) {
                $query->whereIn('slug', $requested)
                    ->orWhereIn('name', $requested);
            })
            ->whereIn('id', $allowedIds)
            ->get();
    }

    private function resolvePermissionIds(Collection $requested, Collection $delegatable): array
    {
        return $this->resolvePermissions($requested, $delegatable)
            ->pluck('id')
            ->values()
            ->all();
    }
}
