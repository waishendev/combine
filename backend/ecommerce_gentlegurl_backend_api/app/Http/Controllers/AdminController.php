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

        $admins = User::with('roles')
            ->whereDoesntHave('roles', function ($query) {
                $query->where('is_system', true);
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

        $roleIds = $this->filterSystemRoleIds($validated['role_ids'] ?? []);
        $user->roles()->sync($roleIds);

        return $this->respond($user->load('roles'), __('Admin created successfully.'));
    }

    public function show(User $admin)
    {
        if ($this->isSystemAdmin($admin)) {
            abort(404);
        }

        return $this->respond($admin->load('roles'));
    }

    public function update(Request $request, User $admin)
    {
        if ($this->isSystemAdmin($admin)) {
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
            $roleIds = $this->filterSystemRoleIds($validated['role_ids'] ?? []);
            $admin->roles()->sync($roleIds);
        }

        return $this->respond($admin->load('roles'), __('Admin updated successfully.'));
    }

    public function destroy(User $admin)
    {
        if ($this->isSystemAdmin($admin)) {
            abort(404);
        }

        $admin->delete();

        return $this->respond(null, __('Admin deleted successfully.'));
    }

    private function isSystemAdmin(User $admin): bool
    {
        return $admin->roles()->where('is_system', true)->exists();
    }

    private function filterSystemRoleIds(array $roleIds): array
    {
        if (empty($roleIds)) {
            return $roleIds;
        }

        return Role::whereIn('id', $roleIds)
            ->where('is_system', false)
            ->pluck('id')
            ->map(fn ($roleId) => (int) $roleId)
            ->values()
            ->all();
    }
}
