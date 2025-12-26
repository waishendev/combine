<?php

namespace App\Http\Controllers;

use App\Models\PermissionGroup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PermissionGroupController extends Controller
{
    public function index(Request $request)
    {
        $query = PermissionGroup::query();

        // Filter by name
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->input('name') . '%');
        }

        // Load permissions only if showPermission = true (default true)
        if ($request->boolean('showPermission', true)) {
            $query->with('permissions');
        }

        $groups = $query->orderBy('sort_order')
            ->paginate($request->integer('per_page', 15));

        return $this->respond($groups);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $sortOrder = $validated['sort_order'] ?? (PermissionGroup::max('sort_order') ?? 0) + 1;

        $group = PermissionGroup::create([
            'name' => $validated['name'],
            'sort_order' => $sortOrder,
        ]);

        return $this->respond($group, __('Permission group created successfully.'));
    }

    public function show(Request $request, PermissionGroup $group)
    {
        // Load permissions when with_permissions parameter is present and truthy
        if ($request->has('with_permissions')) {
            $withPermissions = $request->input('with_permissions');
            if ($withPermissions === 'true' || $withPermissions === true || $withPermissions === '1' || $withPermissions === 1) {
                $group->load('permissions');
            }
        }

        return $this->respond($group);
    }

    public function update(Request $request, PermissionGroup $group)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $group->fill($validated);
        $group->save();

        return $this->respond($group, __('Permission group updated successfully.'));
    }

    public function destroy(PermissionGroup $group)
    {
        $group->permissions()->update(['group_id' => null]);
        $group->delete();

        return $this->respond(null, __('Permission group deleted successfully.'));
    }

    public function moveUp(PermissionGroup $group)
    {
        return DB::transaction(function () use ($group) {
            $oldPosition = $group->sort_order;

            // Find the previous group (lower sort_order)
            $previousGroup = PermissionGroup::where('sort_order', '<', $group->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousGroup) {
                // Already at the top
                return $this->respond(null, __('Permission group is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousGroup->sort_order;

            $group->sort_order = $newPosition;
            $group->save();

            $previousGroup->sort_order = $oldPosition;
            $previousGroup->save();

            // Return metadata only
            return $this->respond([
                'id' => $group->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Permission group moved up successfully.'));
        });
    }

    public function moveDown(PermissionGroup $group)
    {
        return DB::transaction(function () use ($group) {
            $oldPosition = $group->sort_order;

            // Find the next group (higher sort_order)
            $nextGroup = PermissionGroup::where('sort_order', '>', $group->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextGroup) {
                // Already at the bottom
                return $this->respond(null, __('Permission group is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextGroup->sort_order;

            $group->sort_order = $newPosition;
            $group->save();

            $nextGroup->sort_order = $oldPosition;
            $nextGroup->save();

            // Return metadata only
            return $this->respond([
                'id' => $group->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Permission group moved down successfully.'));
        });
    }
}
