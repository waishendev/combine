<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class BranchAccessProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            BranchAccessPermissionSeeder::class,
            BranchAccessDefaultStoreLocationSeeder::class,
        ]);
    }
}
