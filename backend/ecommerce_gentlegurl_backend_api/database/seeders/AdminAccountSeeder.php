<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminAccountSeeder extends Seeder
{
    public function run(): void
    {
        // Default admin credentials: admin.user@example.com / password
        $admin = User::firstOrCreate(
            ['email' => 'gentlegurl@example.com'],
            [
                'name' => 'Admin User',
                'username' => 'admin_user',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $adminRole = Role::where('name', 'admin')->first();

        if ($adminRole) {
            $admin->roles()->sync([$adminRole->id]);
        }
    }
}