<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = $request->string('search')->toString();

        $admins = User::with(['roles', 'staff'])
            ->when(! $request->user()?->canManageSystemAdmins(), function ($query) {
                $query->whereDoesntHave('roles', function ($roleQuery) {
                    $roleQuery->where('is_system', true);
                });
            })
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
        $user->roles()->sync($roleIds);

        return $this->respond($user->load(['roles', 'staff']), __('Admin created successfully.'));
    }

    public function show(Request $request, User $admin)
    {
        $this->ensureSystemAdminAllowed($request->user(), $admin);

        return $this->respond($admin->load(['roles', 'staff']));
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
            $admin->roles()->sync($roleIds);
        }

        return $this->respond($admin->load(['roles', 'staff']), __('Admin updated successfully.'));
    }

    public function destroy(Request $request, User $admin)
    {
        $this->ensureSystemAdminAllowed($request->user(), $admin);

        $admin->delete();

        return $this->respond(null, __('Admin deleted successfully.'));
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
            $query->where('is_system', false)
                ->where('is_default', true);
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
}
