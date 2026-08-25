<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;
use DateTimeInterface;
use App\Models\Permission;
use App\Models\Ecommerce\StoreLocation;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, LogsActivity, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'is_active',
        'last_login_at',
        'last_login_ip',
        'staff_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'staff_id' => 'integer',
        ];
    }


    public function staff()
    {
        return $this->belongsTo(Staff::class);
    }
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function storeLocations()
    {
        return $this->belongsToMany(StoreLocation::class, 'store_location_user')
            ->withTimestamps();
    }

    public function branchRoles()
    {
        return $this->belongsToMany(Role::class, 'role_user_store_location')
            ->withPivot('store_location_id')->withTimestamps();
    }

    public function getAllPermissions(): Collection
    {
        $cacheKey = 'user_all_permission_slugs_'.$this->getKey();
        $cached = request()->attributes->get($cacheKey);
        if ($cached instanceof Collection) {
            return $cached;
        }

        $slugs = $this->roles()->with('permissions')->get()
            ->concat($this->branchRoles()->with('permissions')->get())
            ->flatMap(fn (Role $role) => $role->permissions)
            ->pluck('slug')
            ->unique()
            ->values();

        request()->attributes->set($cacheKey, $slugs);

        return $slugs;
    }

    public function isSuperAdmin(): bool
    {
        $cacheKey = 'user_is_super_admin_'.$this->getKey();
        if (request()->attributes->has($cacheKey)) {
            return (bool) request()->attributes->get($cacheKey);
        }

        $superAdminRoles = array_unique([
            (string) config('auth.super_admin_role', 'infra_core_x1'),
            'infra_core_x1',
        ]);

        $isSuper = $this->roles()->whereIn('name', $superAdminRoles)->exists();
        request()->attributes->set($cacheKey, $isSuper);

        return $isSuper;
    }

    public function canManageSystemAdmins(): bool
    {
        $cacheKey = 'user_can_manage_system_admins_'.$this->getKey();
        if (request()->attributes->has($cacheKey)) {
            return (bool) request()->attributes->get($cacheKey);
        }

        $can = $this->getAllPermissions()->contains('admins.manage-system');
        request()->attributes->set($cacheKey, $can);

        return $can;
    }

    public function delegatablePermissions(): Collection
    {
        $cacheKey = 'user_delegatable_permissions_'.$this->getKey();
        $cached = request()->attributes->get($cacheKey);
        if ($cached instanceof Collection) {
            return $cached;
        }

        if ($this->isSuperAdmin()) {
            $permissions = Permission::query()
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'group_id', 'description']);
            request()->attributes->set($cacheKey, $permissions);

            return $permissions;
        }

        $permissions = $this->roles()
            ->with('permissions:id,name,slug,group_id,description')
            ->get()
            ->concat($this->branchRoles()->with('permissions:id,name,slug,group_id,description')->get())
            ->flatMap(fn (Role $role) => $role->permissions)
            ->unique('id')
            ->values();

        request()->attributes->set($cacheKey, $permissions);

        return $permissions;
    }

    /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
     */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
