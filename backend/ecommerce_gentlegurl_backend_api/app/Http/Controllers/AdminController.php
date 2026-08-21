<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function __construct(private StoreLocationAccessService $storeLocationAccess)
    {
    }

    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = $request->string('search')->toString();
        $storeLocationId = $request->integer('branch_store_location_id');
        if ($storeLocationId > 0) {
            $this->storeLocationAccess->authorizeStoreLocation($request->user(), $storeLocationId, false);
        }
        $accessibleIds = $this->storeLocationAccess->accessibleStoreLocations($request->user(), false)->pluck('id');

        $admins = User::with(['roles', 'staff', 'storeLocations'])
            ->when(! $request->user()?->canManageSystemAdmins(), function ($query) {
                $query->whereDoesntHave('roles', function ($roleQuery) {
                    $roleQuery->where('is_system', true);
                });
            })
            ->when($storeLocationId > 0, function ($query) use ($request, $storeLocationId) {
                $query->where(function ($scope) use ($request, $storeLocationId) {
                    $scope->whereHas('storeLocations', fn ($locations) => $locations->where('store_locations.id', $storeLocationId));

                    // Platform Admins access every Branch through the established
                    // infra_core_x1 bypass and intentionally have no pivot rows.
                    if ($request->user()?->canManageSystemAdmins()) {
                        $scope->orWhereHas('roles', fn ($roles) => $roles->where('name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE));
                    }
                });
            })
            ->when($storeLocationId <= 0 && ! $this->storeLocationAccess->hasPlatformBypass($request->user()), fn ($query) => $query->whereHas('storeLocations', fn ($locations) => $locations->whereIn('store_locations.id', $accessibleIds)))
            ->when($search, function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%");
                });
            })
            ->paginate($perPage);

        return $this->respond($admins);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'username' => ['nullable', 'string', 'max:100', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'store_location_ids' => ['sometimes', 'array'],
            'store_location_ids.*' => ['integer', 'exists:store_locations,id'],
        ]);

        $username = isset($validated['username']) ? trim((string) $validated['username']) : null;
        if ($username === '') {
            $username = null;
        }

        $user = User::create([
            'name' => $username ?: (string) strstr($validated['email'], '@', true),
            'email' => $validated['email'],
            'username' => $username,
            'password' => $validated['password'],
            'is_active' => $validated['is_active'] ?? true,
            'staff_id' => $validated['staff_id'] ?? null,
        ]);

        $roleIds = $this->filterAssignableRoleIds($validated['role_ids'] ?? [], $request->user());
        $this->syncStoreLocations($request, $user, $validated['store_location_ids'] ?? null);
        $this->syncRoles($user, $roleIds, $validated['store_location_ids'] ?? []);

        return $this->respond($user->load(['roles', 'staff', 'storeLocations']), __('Admin created successfully.'));
    }

    public function show(Request $request, User $admin)
    {
        $this->ensureSystemAdminAllowed($request->user(), $admin);

        return $this->respond($admin->load(['roles', 'staff', 'storeLocations']));
    }

    public function update(Request $request, User $admin)
    {
        $this->ensureSystemAdminAllowed($request->user(), $admin);

        $validated = $request->validate([
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)],
            'username' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('users', 'username')->ignore($admin->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['sometimes', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'store_location_ids' => ['sometimes', 'array'],
            'store_location_ids.*' => ['integer', 'exists:store_locations,id'],
        ]);

        if (array_key_exists('username', $validated)) {
            $username = trim((string) ($validated['username'] ?? ''));
            $validated['username'] = $username === '' ? null : $username;
            if (($validated['username'] ?? null) && empty($admin->name)) {
                $validated['name'] = $validated['username'];
            }
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $admin->fill($validated);
        $admin->save();

        if ($request->has('role_ids')) {
            $roleIds = $this->filterAssignableRoleIds($validated['role_ids'] ?? [], $request->user());
            $branchIds = $validated['store_location_ids'] ?? $admin->storeLocations()->pluck('store_locations.id')->all();
            $this->syncRoles($admin, $roleIds, $branchIds);
        }

        $this->syncStoreLocations($request, $admin, $validated['store_location_ids'] ?? null);

        return $this->respond($admin->load(['roles', 'staff', 'storeLocations']), __('Admin updated successfully.'));
    }

    public function destroy(Request $request, User $admin)
    {
        $this->ensureSystemAdminAllowed($request->user(), $admin);

        $admin->delete();

        return $this->respond(null, __('Admin deleted successfully.'));
    }

    private function syncStoreLocations(Request $request, User $admin, ?array $storeLocationIds): void
    {
        if (! $request->has('store_location_ids')) {
            return;
        }

        if ($request->user()?->id === $admin->id) {
            abort(403, __('You cannot change your own branch assignments.'));
        }

        if (! $request->user()?->getAllPermissions()->contains('branch_access.assign')) {
            abort(403, __('You are not allowed to assign branches.'));
        }

        if ($this->storeLocationAccess->hasPlatformBypass($admin)) {
            $admin->storeLocations()->sync([]);
            return;
        }

        $ids = $this->storeLocationAccess->assertCanAssign($request->user(), $storeLocationIds ?? [], true);
        $admin->storeLocations()->sync($ids);
    }

    private function ensureSystemAdminAllowed(?User $actor, User $targetAdmin): void
    {
        if (! $actor?->canManageSystemAdmins() && $targetAdmin->roles()->where('is_system', true)->exists()) {
            abort(404);
        }
    }

    private function filterAssignableRoleIds(array $roleIds, ?User $actor): array
    {
        if (empty($roleIds)) {
            return $roleIds;
        }

        $query = Role::whereIn('id', $roleIds);

        if (! $actor?->canManageSystemAdmins()) {
            $query->where('is_system', false);
        }

        $assignableRoleIds = $query
            ->pluck('id')
            ->map(fn ($roleId) => (int) $roleId)
            ->values()
            ->all();

        if (count($assignableRoleIds) !== count(array_unique($roleIds))) {
            abort(403, __('You are not allowed to assign one or more selected roles.'));
        }

        return $assignableRoleIds;
    }

    private function syncRoles(User $admin, array $roleIds, array $storeLocationIds): void
    {
        $roles = Role::query()->whereIn('id', $roleIds)->get();
        $branchIds = collect($storeLocationIds)->map(fn ($id) => (int) $id)->unique();

        foreach ($roles->whereNotNull('store_location_id') as $role) {
            abort_unless($branchIds->contains((int) $role->store_location_id), 422,
                __('A Branch Role can only be assigned together with its owning Branch.'));
        }

        // Global/system roles retain the legacy pivot. Operational roles are explicit per Branch.
        $admin->roles()->sync($roles->whereNull('store_location_id')->pluck('id')->all());
        $pivotRows = $roles->whereNotNull('store_location_id')->mapWithKeys(fn (Role $role) => [
            $role->id => ['store_location_id' => (int) $role->store_location_id],
        ])->all();
        $admin->branchRoles()->sync($pivotRows);
    }
}
