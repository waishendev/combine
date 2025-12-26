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
            $groupsQuery = PermissionGroup::with(['permissions' => function ($query) use ($request) {
                // Filter permissions within groups
                if ($request->filled('name')) {
                    $query->where('name', 'like', '%' . $request->input('name') . '%');
                }
                if ($request->filled('slug')) {
                    $query->where('slug', 'like', '%' . $request->input('slug') . '%');
                }
                $query->orderBy('name');
            }])->orderBy('sort_order');

            // Filter groups by group_id if provided
            if ($request->filled('group')) {
                $groupsQuery->where('id', $request->input('group'));
            }

            $groups = $groupsQuery->get();

            $ungroupedQuery = Permission::whereNull('group_id');
            
            if ($request->filled('name')) {
                $ungroupedQuery->where('name', 'like', '%' . $request->input('name') . '%');
            }
            if ($request->filled('slug')) {
                $ungroupedQuery->where('slug', 'like', '%' . $request->input('slug') . '%');
            }
            
            $ungrouped = $ungroupedQuery->orderBy('name')->get();

            return $this->respond([
                'groups' => $groups,
                'ungrouped' => $ungrouped,
            ]);
        }

        $query = Permission::query();

        // Filter by name
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->input('name') . '%');
        }

        // Filter by slug
        if ($request->filled('slug')) {
            $query->where('slug', 'like', '%' . $request->input('slug') . '%');
        }

        // Filter by group (group_id)
        if ($request->filled('group')) {
            $query->where('group_id', $request->input('group'));
        }

        $permissions = $query->with('group')->paginate($request->integer('per_page', 15));

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
