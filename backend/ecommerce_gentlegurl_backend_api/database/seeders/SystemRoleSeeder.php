<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SystemRoleSeeder extends Seeder
{
    public function run(): void
    {
        $systemRoleName = 'Super Admin';

        $systemRole = Role::firstOrNew(['name' => $systemRoleName]);
        $systemRole->description = 'Full access to all admin features';
        $systemRole->is_active = true;
        $systemRole->is_system = true;
        $systemRole->save();

        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Super Admin',
                'username' => 'admin',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $admin->roles()->sync([$systemRole->id]);
    }
}
