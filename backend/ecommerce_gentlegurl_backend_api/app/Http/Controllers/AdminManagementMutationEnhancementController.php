<?php

namespace App\Http\Controllers;

use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin management mutation enhancement (create / edit / delete / move).
 *
 * Enhancement id: admin-management-mutation-v1
 */
class AdminManagementMutationEnhancementController extends Controller
{
    public const ENHANCEMENT = 'admin-management-mutation-v1';

    public const SLIM_FLAG = '_admin_mgmt_slim_mutation';

    public function __construct(
        private RoleController $roles,
        private AdminController $admins,
    ) {
    }

    /**
     * Slim role edit payload — role + assigned permission slugs only (no catalog).
     * CRM already loads /permissions/delegatable/query when the modal opens.
     */
    public function roleEdit(Request $request, Role $role)
    {
        $this->roles->authorizeRoleForEnhancement($request, $role);
        $this->roles->ensureNotSystemRoleForEnhancement($role, $request->user(), true);

        $user = $request->user();
        $role->load(['permissions:id,name,slug', 'storeLocation:id,name']);
        $role->loadCount('permissions');

        if (! $user?->isSuperAdmin()) {
            $delegatableIds = $user->delegatablePermissions()->pluck('id')->all();
            $role->setRelation(
                'permissions',
                $role->permissions->whereIn('id', $delegatableIds)->values()
            );
        }

        return $this->respond([
            'meta' => ['enhancement' => self::ENHANCEMENT],
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'is_active' => (bool) $role->is_active,
                'store_location_id' => $role->store_location_id,
                'store_location' => $role->storeLocation,
                'permissions_count' => (int) ($role->permissions_count ?? $role->permissions->count()),
                'permissions' => $role->permissions
                    ->map(fn ($permission) => [
                        'id' => $permission->id,
                        'name' => $permission->name,
                        'slug' => $permission->slug,
                    ])
                    ->values(),
            ],
        ]);
    }

    public function roleStore(Request $request)
    {
        $request->attributes->set(self::SLIM_FLAG, true);

        return $this->slimRoleResponse($this->roles->store($request));
    }

    public function roleUpdate(Request $request, Role $role)
    {
        $request->attributes->set(self::SLIM_FLAG, true);

        return $this->slimRoleResponse($this->roles->update($request, $role));
    }

    public function roleDestroy(Request $request, Role $role)
    {
        return $this->roles->destroy($request, $role);
    }

    public function adminShow(Request $request, User $admin)
    {
        $request->attributes->set(self::SLIM_FLAG, true);

        return $this->slimAdminResponse($this->admins->show($request, $admin));
    }

    public function adminStore(Request $request)
    {
        $request->attributes->set(self::SLIM_FLAG, true);

        return $this->slimAdminResponse($this->admins->store($request));
    }

    public function adminUpdate(Request $request, User $admin)
    {
        $request->attributes->set(self::SLIM_FLAG, true);

        return $this->slimAdminResponse($this->admins->update($request, $admin));
    }

    public function adminDestroy(Request $request, User $admin)
    {
        return $this->admins->destroy($request, $admin);
    }

    public function permissionGroupMoveUp(PermissionGroup $group)
    {
        return $this->moveGroup($group, 'up');
    }

    public function permissionGroupMoveDown(PermissionGroup $group)
    {
        return $this->moveGroup($group, 'down');
    }

    private function moveGroup(PermissionGroup $group, string $direction)
    {
        return DB::transaction(function () use ($group, $direction) {
            $oldPosition = $group->sort_order;
            $neighbor = $direction === 'up'
                ? PermissionGroup::query()->where('sort_order', '<', $group->sort_order)->orderByDesc('sort_order')->first()
                : PermissionGroup::query()->where('sort_order', '>', $group->sort_order)->orderBy('sort_order')->first();

            if (! $neighbor) {
                $message = $direction === 'up'
                    ? __('Permission group is already at the top.')
                    : __('Permission group is already at the bottom.');

                return $this->respond(null, $message, false, 400);
            }

            $newPosition = $neighbor->sort_order;
            $group->sort_order = $newPosition;
            $group->save();
            $neighbor->sort_order = $oldPosition;
            $neighbor->save();

            return $this->respond([
                'meta' => ['enhancement' => self::ENHANCEMENT],
                'moved' => [
                    'id' => $group->id,
                    'sort_order' => (int) $group->sort_order,
                    'old_position' => $oldPosition,
                    'new_position' => $newPosition,
                ],
                'swapped' => [
                    'id' => $neighbor->id,
                    'sort_order' => (int) $neighbor->sort_order,
                ],
            ], $direction === 'up'
                ? __('Permission group moved up successfully.')
                : __('Permission group moved down successfully.'));
        });
    }

    private function slimRoleResponse(JsonResponse $response): JsonResponse
    {
        if ($response->getStatusCode() >= 400) {
            return $response;
        }

        $payload = json_decode($response->getContent(), true);
        $role = $payload['data'] ?? null;
        if (! is_array($role)) {
            return $response;
        }

        $permissions = is_array($role['permissions'] ?? null) ? $role['permissions'] : [];
        $payload['data'] = [
            'id' => $role['id'] ?? null,
            'name' => $role['name'] ?? null,
            'description' => $role['description'] ?? null,
            'is_active' => $role['is_active'] ?? null,
            'store_location_id' => $role['store_location_id'] ?? null,
            'store_location' => $role['store_location'] ?? null,
            'permissions_count' => $role['permissions_count'] ?? count($permissions),
            'created_at' => $role['created_at'] ?? null,
            'updated_at' => $role['updated_at'] ?? null,
        ];
        $payload['meta'] = ['enhancement' => self::ENHANCEMENT];

        return response()->json($payload, $response->getStatusCode());
    }

    private function slimAdminResponse(JsonResponse $response): JsonResponse
    {
        if ($response->getStatusCode() >= 400) {
            return $response;
        }

        $payload = json_decode($response->getContent(), true);
        $admin = $payload['data'] ?? null;
        if (! is_array($admin)) {
            return $response;
        }

        $roles = is_array($admin['roles'] ?? null) ? $admin['roles'] : [];
        $locations = is_array($admin['store_locations'] ?? null) ? $admin['store_locations'] : [];
        $payload['data'] = [
            'id' => $admin['id'] ?? null,
            'name' => $admin['name'] ?? null,
            'username' => $admin['username'] ?? null,
            'email' => $admin['email'] ?? null,
            'is_active' => $admin['is_active'] ?? null,
            'roles' => array_map(static fn ($role) => [
                'id' => $role['id'] ?? null,
                'name' => $role['name'] ?? null,
                'is_system' => $role['is_system'] ?? null,
                'is_default' => $role['is_default'] ?? null,
            ], $roles),
            'store_locations' => array_map(static fn ($location) => [
                'id' => $location['id'] ?? null,
                'name' => $location['name'] ?? null,
                'code' => $location['code'] ?? null,
                'is_active' => $location['is_active'] ?? null,
            ], $locations),
            'created_at' => $admin['created_at'] ?? null,
            'updated_at' => $admin['updated_at'] ?? null,
        ];
        $payload['meta'] = ['enhancement' => self::ENHANCEMENT];

        return response()->json($payload, $response->getStatusCode());
    }
}
