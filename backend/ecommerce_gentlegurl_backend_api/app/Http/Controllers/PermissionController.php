<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\PermissionGroup;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        if ($request->boolean('grouped')) {
            $groups = PermissionGroup::with(['permissions' => function ($query) {
                $query->orderBy('name');
            }])->orderBy('sort_order')->get();

            $ungrouped = Permission::whereNull('group_id')->orderBy('name')->get();

            return $this->respond([
                'groups' => $groups,
                'ungrouped' => $ungrouped,
            ]);
        }

        $permissions = Permission::with('group')->paginate($request->integer('per_page', 15));

        return $this->respond($permissions);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'group_id' => ['nullable', 'integer', 'exists:permission_groups,id'],
            'name' => ['required', 'string', 'max:150', 'unique:permissions,name'],
            'slug' => ['required', 'string', 'max:150', 'unique:permissions,slug'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $permission = Permission::create($validated);

        return $this->respond($permission->load('group'), __('Permission created successfully.'));
    }

    public function show(Permission $permission)
    {
        return $this->respond($permission->load('group'));
    }

    public function update(Request $request, Permission $permission)
    {
        $validated = $request->validate([
            'group_id' => ['nullable', 'integer', 'exists:permission_groups,id'],
            'name' => ['sometimes', 'string', 'max:150', Rule::unique('permissions', 'name')->ignore($permission->id)],
            'slug' => ['sometimes', 'string', 'max:150', Rule::unique('permissions', 'slug')->ignore($permission->id)],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $permission->fill($validated);
        $permission->save();

        return $this->respond($permission->load('group'), __('Permission updated successfully.'));
    }

    public function destroy(Permission $permission)
    {
        $permission->delete();

        return $this->respond(null, __('Permission deleted successfully.'));
    }
}
