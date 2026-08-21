<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;
use RuntimeException;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $branch = StoreLocation::query()
            ->where('code', config('multi_branch.fresh_seed_branches.branch_one.code'))
            ->first();
        if (! $branch) {
            throw new RuntimeException('Branch One must exist before ExpenseCategorySeeder runs.');
        }

        foreach (['Rental', 'Utilities', 'Salary', 'Commission', 'Marketing', 'Maintenance', 'Office Supplies', 'Internet', 'Transport', 'Cleaning', 'Food', 'Miscellaneous'] as $sort => $name) {
            ExpenseCategory::query()->firstOrCreate(
                ['store_location_id' => $branch->id, 'name' => $name],
                ['sort_order' => $sort + 1, 'is_active' => true],
            );
        }
    }
}
