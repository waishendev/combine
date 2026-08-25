<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\User;
use App\Services\ExpenseBranchScope;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;

/**
 * Admin management query enhancement (P0 indexes + P1 ACL memo + P2 list APIs).
 *
 * Enhancement id: admin-management-query-v1
 */
class AdminManagementQueryEnhancementController extends Controller
{
    public const ENHANCEMENT = 'admin-management-query-v1';

    public function __construct(private StoreLocationAccessService $branchAccess)
    {
    }

    /**
     * CRM /admins first paint — admins page + optional slim roles for filters/create.
     */
    public function adminsOverview(Request $request)
    {
        return $this->respond([
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'includes' => ['admins', 'roles'],
            ],
            'admins' => $this->buildAdminsPayload($request),
            'roles' => $this->buildRolesDropdownPayload($request),
        ]);
    }

    /**
     * CRM /admins pagination + server-side filters.
     */
    public function admins(Request $request)
    {
        return $this->respond($this->buildAdminsPayload($request));
    }

    /**
     * CRM /roles first paint — slim roles (count only, no nested permissions).
     */
    public function rolesOverview(Request $request)
    {
        return $this->respond([
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'includes' => ['roles'],
            ],
            'roles' => $this->buildRolesPayload($request, withPermissions: false),
        ]);
    }

    /**
     * CRM /roles pagination / name / active filters (slim).
     */
    public function roles(Request $request)
    {
        return $this->respond($this->buildRolesPayload($request, withPermissions: false));
    }

    /**
     * CRM /permission first paint — permissions page + groups dropdown.
     */
    public function permissionsOverview(Request $request)
    {
        return $this->respond([
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'includes' => ['permissions', 'groups'],
            ],
            'permissions' => $this->buildPermissionsPayload($request),
            'groups' => $this->buildGroupsPayload($request, withPermissions: false, perPageDefault: 200),
        ]);
    }

    /**
     * CRM /permission pagination / filters.
     */
    public function permissions(Request $request)
    {
        return $this->respond($this->buildPermissionsPayload($request));
    }

    /**
     * CRM /permission-groups list (no nested permissions by default).
     */
    public function permissionGroups(Request $request)
    {
        return $this->respond($this->buildGroupsPayload(
            $request,
            withPermissions: $request->boolean('showPermission', false),
            perPageDefault: 50,
        ));
    }

    /**
     * Slim delegatable catalog for role create/edit modals.
     */
    public function delegatable(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        $rows = $user->delegatablePermissions()
            ->map(fn (Permission $permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
                'slug' => $permission->slug,
                'group_id' => $permission->group_id,
            ])
            ->values();

        return $this->respond($rows);
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function buildAdminsPayload(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 15), 1), 200);
        $storeLocationId = $request->integer('branch_store_location_id');
        if ($storeLocationId > 0) {
            $this->branchAccess->authorizeStoreLocation($request->user(), $storeLocationId, false);
        }
        $accessibleIds = $this->branchAccess->accessibleStoreLocations($request->user(), false)->pluck('id');

        $username = trim((string) $request->query('username', ''));
        $email = trim((string) $request->query('email', ''));
        $search = trim((string) $request->query('search', ''));
        $roleId = $request->integer('role_id');

        $query = User::query()
            ->with(['roles', 'staff', 'storeLocations'])
            ->when(! $request->user()?->canManageSystemAdmins(), function ($builder) {
                $builder->whereDoesntHave('roles', fn ($roleQuery) => $roleQuery->where('is_system', true));
            })
            ->when($storeLocationId > 0, function ($builder) use ($request, $storeLocationId) {
                $builder->where(function ($scope) use ($request, $storeLocationId) {
                    $scope->whereHas('storeLocations', fn ($locations) => $locations->where('store_locations.id', $storeLocationId));
                    if ($request->user()?->canManageSystemAdmins()) {
                        $scope->orWhereHas('roles', fn ($roles) => $roles->where('name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE));
                    }
                });
            })
            ->when(
                $storeLocationId <= 0 && ! $this->branchAccess->hasPlatformBypass($request->user()),
                fn ($builder) => $builder->whereHas('storeLocations', fn ($locations) => $locations->whereIn('store_locations.id', $accessibleIds))
            );

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($username !== '') {
            $query->where('username', 'like', "%{$username}%");
        }
        if ($email !== '') {
            $query->where('email', 'like', "%{$email}%");
        }
        if ($roleId > 0) {
            $query->whereHas('roles', fn ($roles) => $roles->where('roles.id', $roleId));
        }
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        return $query->orderBy('id')->paginate($perPage)->withQueryString();
    }

    /**
     * @return \Illuminate\Support\Collection<int, Role>
     */
    public function buildRolesDropdownPayload(Request $request)
    {
        $scope = ExpenseBranchScope::fromRequest($request, $this->branchAccess);
        $query = Role::query()->select(['id', 'name', 'is_system', 'is_default', 'is_active', 'store_location_id']);
        $scope->apply($query);
        if (! $request->user()?->canManageSystemAdmins()) {
            $query->where(fn ($roles) => $roles->where('is_system', false)->orWhereNotNull('store_location_id'));
        }
        $query->where('is_active', true);

        return $query->orderBy('name')->limit(200)->get();
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function buildRolesPayload(Request $request, bool $withPermissions)
    {
        $scope = ExpenseBranchScope::fromRequest($request, $this->branchAccess);
        $query = Role::query()->with('storeLocation:id,name');
        $scope->apply($query);
        if (! $request->user()?->canManageSystemAdmins()) {
            $query->where(fn ($roles) => $roles->where('is_system', false)->orWhereNotNull('store_location_id'));
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('name')) {
            $query->where('name', 'like', '%'.$request->input('name').'%');
        }

        if ($withPermissions) {
            $query->with('permissions:id,name,slug,group_id');
        } else {
            $query->withCount('permissions');
        }

        return $query->orderBy('id')->paginate(min(max($request->integer('per_page', 15), 1), 200))->withQueryString();
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function buildPermissionsPayload(Request $request)
    {
        $query = Permission::query()->with('group:id,name,sort_order');

        if ($request->filled('name')) {
            $query->where('name', 'like', '%'.$request->input('name').'%');
        }
        if ($request->filled('slug')) {
            $query->where('slug', 'like', '%'.$request->input('slug').'%');
        }

        // CRM sends group_id; legacy API used "group".
        $groupId = $request->query('group_id', $request->query('group'));
        if ($groupId !== null && $groupId !== '') {
            $query->where('group_id', (int) $groupId);
        }

        return $query->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 15), 1), 200))
            ->withQueryString();
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function buildGroupsPayload(Request $request, bool $withPermissions, int $perPageDefault)
    {
        $query = PermissionGroup::query();
        if ($request->filled('name')) {
            $query->where('name', 'like', '%'.$request->input('name').'%');
        }
        if ($withPermissions) {
            $query->with('permissions:id,name,slug,group_id');
        } else {
            $query->withCount('permissions');
        }

        return $query->orderBy('sort_order')
            ->paginate(min(max($request->integer('per_page', $perPageDefault), 1), 200))
            ->withQueryString();
    }
}
