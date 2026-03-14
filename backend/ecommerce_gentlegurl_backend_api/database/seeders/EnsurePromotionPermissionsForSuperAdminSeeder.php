<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class EnsurePromotionPermissionsForSuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $slugs = [
            'ecommerce.promotions.view',
            'ecommerce.promotions.create',
            'ecommerce.promotions.update',
            'ecommerce.promotions.delete',
        ];

        $permissionIds = Permission::whereIn('slug', $slugs)->pluck('id')->all();
        if (empty($permissionIds)) {
            return;
        }

        $superAdminRole = Role::where('name', 'infra_core_x1')->first();
        if ($superAdminRole) {
            $superAdminRole->permissions()->syncWithoutDetaching($permissionIds);
        }

        $superAdminUser = User::where('email', 'infrax1@example.com')->first();
        if ($superAdminUser && $superAdminRole) {
            $superAdminUser->roles()->syncWithoutDetaching([$superAdminRole->id]);
        }
    }
}
