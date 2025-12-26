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
        $superAdminRole = $this->superAdminRoleName();

        $admins = User::with('roles')
            ->whereDoesntHave('roles', function ($query) use ($superAdminRole) {
                $query->where('name', $superAdminRole);
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'username' => ['required', 'string', 'max:100', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $validated['password'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $roleIds = $this->filterSuperAdminRoleIds($validated['role_ids'] ?? []);
        $user->roles()->sync($roleIds);

        return $this->respond($user->load('roles'), __('Admin created successfully.'));
    }

    public function show(User $admin)
    {
        if ($this->isSuperAdmin($admin)) {
            abort(404);
        }

        return $this->respond($admin->load('roles'));
    }

    public function update(Request $request, User $admin)
    {
        if ($this->isSuperAdmin($admin)) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)],
            'username' => ['sometimes', 'string', 'max:100', Rule::unique('users', 'username')->ignore($admin->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $admin->fill($validated);

        $admin->save();

        if ($request->has('role_ids')) {
            $roleIds = $this->filterSuperAdminRoleIds($validated['role_ids'] ?? []);
            $admin->roles()->sync($roleIds);
        }

        return $this->respond($admin->load('roles'), __('Admin updated successfully.'));
    }

    public function destroy(User $admin)
    {
        if ($this->isSuperAdmin($admin)) {
            abort(404);
        }

        $admin->delete();

        return $this->respond(null, __('Admin deleted successfully.'));
    }

    private function superAdminRoleName(): string
    {
        return config('auth.super_admin_role', 'super_admin');
    }

    private function isSuperAdmin(User $admin): bool
    {
        return $admin->roles()->where('name', $this->superAdminRoleName())->exists();
    }

    private function filterSuperAdminRoleIds(array $roleIds): array
    {
        $superAdminRoleId = Role::where('name', $this->superAdminRoleName())->value('id');

        if (!$superAdminRoleId) {
            return $roleIds;
        }

        return array_values(array_filter(
            $roleIds,
            fn ($roleId) => (int) $roleId !== (int) $superAdminRoleId
        ));
    }
}
