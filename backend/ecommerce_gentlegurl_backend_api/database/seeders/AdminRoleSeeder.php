<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AdminRoleSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::firstOrNew(['name' => 'admin']);
        $role->description = 'Full access to admin features';
        $role->is_active = true;
        $role->is_system = false;
        $role->save();

        $role->permissions()->sync(Permission::pluck('id')->all());
    }
}
