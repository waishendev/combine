<?php

namespace Database\Seeders;

class FreshInstallBranchTwoSeeder extends ConfiguredFreshInstallBranchSeeder
{
    public function run(): void
    {
        $this->seedBranch('branch_two');
    }
}
