<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            SystemRoleSeeder::class,
            AdminRoleSeeder::class,
            AdminAccountSeeder::class,
            RoleSeeder::class,
        ]);
    }
}
