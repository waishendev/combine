<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminRole = Role::where('name', 'infra_core_x1')->first();

        if (!$superAdminRole) {
            $this->command->error('Super Admin role (infra_core_x1) not found. Please run RoleSeeder first.');
            return;
        }

        $superAdminUser = User::firstOrCreate(
            ['email' => 'infrax1@example.com'],
            [
                'name' => 'Infra Core X1',
                'username' => 'infrax1',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $superAdminUser->roles()->syncWithoutDetaching([$superAdminRole->id]);
    }
}

