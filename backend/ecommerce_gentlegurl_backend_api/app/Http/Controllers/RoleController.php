<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\Request;
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
    

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:roles,name'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
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

        $role->permissions()->sync($validated['permission_ids'] ?? []);

        return $this->respond($role->load('permissions'), __('Role created successfully.'));
    }

    public function show(Role $role)
    {
        $this->ensureNotSystemRole($role);

        return $this->respond($role->load('permissions'));
    }

    public function update(Request $request, Role $role)
    {
        $this->ensureNotSystemRole($role);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
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
        $this->ensureNotSystemRole($role);

        $role->delete();

        return $this->respond(null, __('Role deleted successfully.'));
    }

    private function ensureNotSystemRole(Role $role): void
    {
        if ($role->is_system) {
            abort(404);
        }
    }
}
