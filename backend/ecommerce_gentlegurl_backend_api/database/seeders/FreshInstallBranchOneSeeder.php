<?php

namespace Database\Seeders;

class FreshInstallBranchOneSeeder extends ConfiguredFreshInstallBranchSeeder
{
    public function run(): void
    {
        $this->seedBranch('branch_one');
    }
}
