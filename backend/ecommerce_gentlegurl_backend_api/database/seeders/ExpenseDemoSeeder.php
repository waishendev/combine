<?php

namespace Database\Seeders;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class ExpenseDemoSeeder extends Seeder
{
    /**
     * Seed a small, idempotent set of local-only records for exercising the CRM list,
     * totals, category filter, search, and CSV export.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Expense demo records are not seeded in production.');

            return;
        }

        $user = User::query()->orderBy('id')->first();
        if (! $user) {
            $this->command?->warn('Expense demo records were skipped because no CRM user exists.');

            return;
        }

        $categories = ExpenseCategory::query()
            ->whereIn('name', ['Utilities', 'Marketing', 'Office Supplies'])
            ->get()
            ->keyBy('name');

        if ($categories->count() !== 3) {
            $this->command?->warn('Expense demo records were skipped because default expense categories are missing.');

            return;
        }

        $month = Carbon::today()->startOfMonth();
        $prefix = 'EXP-'.$month->format('Ym').'-9';
        $expenses = [
            ['expense_no' => $prefix.'0001', 'category' => 'Utilities', 'expense_date' => $month->copy()->addDays(1), 'title' => 'Demo Electricity Bill', 'amount' => 185.60, 'remark' => 'Demo monthly electricity expense.'],
            ['expense_no' => $prefix.'0002', 'category' => 'Marketing', 'expense_date' => $month->copy()->addDays(5), 'title' => 'Demo Facebook Advertisement', 'amount' => 250.00, 'remark' => 'Demo social media campaign expense.'],
            ['expense_no' => $prefix.'0003', 'category' => 'Office Supplies', 'expense_date' => $month->copy()->addDays(9), 'title' => 'Demo Cleaning Supplies', 'amount' => 78.90, 'remark' => 'Demo office and cleaning supplies.'],
        ];

        foreach ($expenses as $data) {
            Expense::updateOrCreate(
                ['expense_no' => $data['expense_no']],
                [
                    'expense_category_id' => $categories[$data['category']]->id,
                    'expense_date' => $data['expense_date']->toDateString(),
                    'title' => $data['title'],
                    'amount' => $data['amount'],
                    'remark' => $data['remark'],
                    'receipt_path' => null,
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                ]
            );
        }

        $this->command?->info('Expense demo records created/updated.');
    }
}
