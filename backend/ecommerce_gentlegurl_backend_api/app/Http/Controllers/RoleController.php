<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $roles = Role::with('permissions')->paginate($request->integer('per_page', 15));

        return $this->respond($roles);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:roles,name'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $role->permissions()->sync($validated['permission_ids'] ?? []);

        return $this->respond($role->load('permissions'), __('Role created successfully.'));
    }

    public function show(Role $role)
    {
        return $this->respond($role->load('permissions'));
    }

    public function update(Request $request, Role $role)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', Rule::unique('roles', 'name')->ignore($role->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->fill($validated);
        $role->save();

        if ($request->has('permission_ids')) {
            $role->permissions()->sync($validated['permission_ids'] ?? []);
        }

        return $this->respond($role->load('permissions'), __('Role updated successfully.'));
    }

    public function destroy(Role $role)
    {
        $role->delete();

        return $this->respond(null, __('Role deleted successfully.'));
    }
}
