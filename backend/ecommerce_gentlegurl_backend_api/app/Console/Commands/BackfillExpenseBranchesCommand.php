<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BackfillExpenseBranchesCommand extends Command
{
    protected $signature = 'expense-branch:backfill
        {--store-code= : Existing Branch code that owns the legacy Expense data}
        {--dry-run : Audit and report without changing data}
        {--force : Apply the audited NULL-only backfill}';

    protected $description = 'Explicitly assign legacy unassigned Expense Management rows to an existing Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        if ($code === '' || $dryRun === $force) {
            $this->error('Provide an explicit --store-code and exactly one of --dry-run or --force.');
            $this->line('Examples:');
            $this->line('  php artisan expense-branch:backfill --store-code=PNG --dry-run');
            $this->line('  php artisan expense-branch:backfill --store-code=PNG --force');

            return self::FAILURE;
        }

        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) {
            $this->error("Branch code [{$code}] does not exist. No rows were changed.");

            return self::FAILURE;
        }

        $audit = $this->audit((int) $branch->id);
        $this->report($branch, $audit);

        if ($dryRun) {
            $this->newLine();
            $this->info('DRY RUN ONLY — no rows changed.');

            return self::SUCCESS;
        }

        if ($audit['conflicts']->isNotEmpty()) {
            $this->error('Backfill aborted: resolve the Expense/Category Branch conflicts listed above. No rows were changed.');

            return self::FAILURE;
        }

        try {
            [$categoriesUpdated, $expensesUpdated] = DB::transaction(function () use ($branch): array {
                // Re-audit inside the write transaction so validation and updates share one snapshot.
                $audit = $this->audit((int) $branch->id, true);
                if ($audit['conflicts']->isNotEmpty()) {
                    throw new RuntimeException('Expense/Category Branch conflicts appeared before the backfill could acquire its locks.');
                }
                $mismatchesBefore = $this->targetMismatchCount((int) $branch->id);

                $categoriesUpdated = DB::table('expense_categories')
                    ->whereNull('store_location_id')
                    ->update(['store_location_id' => $branch->id, 'updated_at' => now()]);
                $expensesUpdated = DB::table('expenses')
                    ->whereNull('store_location_id')
                    ->update(['store_location_id' => $branch->id, 'updated_at' => now()]);

                $mismatchesAfter = $this->targetMismatchCount((int) $branch->id);
                if ($mismatchesAfter > $mismatchesBefore) {
                    throw new RuntimeException('Verification found '.($mismatchesAfter - $mismatchesBefore).' new Expense/Category Branch mismatch(es).');
                }

                return [$categoriesUpdated, $expensesUpdated];
            }, 3);
        } catch (\Throwable $exception) {
            $this->error('Backfill rolled back: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Expense Branch backfill completed successfully.');
        $this->table(['Result', 'Count'], [
            ['Categories updated', $categoriesUpdated],
            ['Expenses updated', $expensesUpdated],
            ['Rows skipped because already attributed', $audit['categories_attributed'] + $audit['expenses_attributed']],
            ['Conflicts/errors', 0],
        ]);

        return self::SUCCESS;
    }

    private function targetMismatchCount(int $targetId): int
    {
        return DB::table('expenses')
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->whereColumn('expenses.store_location_id', '<>', 'expense_categories.store_location_id')
            ->where(function ($query) use ($targetId) {
                $query->where('expenses.store_location_id', $targetId)
                    ->orWhere('expense_categories.store_location_id', $targetId);
            })
            ->count();
    }

    /** @return array<string, mixed> */
    private function audit(int $targetId, bool $lock = false): array
    {
        if ($lock) {
            DB::table('expense_categories')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
            DB::table('expenses')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
        }
        $categories = DB::table('expense_categories');
        $expenses = DB::table('expenses');

        $relationshipConflicts = DB::table('expenses')
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->where(function ($query) use ($targetId) {
                $query->where(function ($candidateExpense) use ($targetId) {
                    $candidateExpense->whereNull('expenses.store_location_id')
                        ->whereNotNull('expense_categories.store_location_id')
                        ->where('expense_categories.store_location_id', '<>', $targetId);
                })->orWhere(function ($candidateCategory) use ($targetId) {
                    $candidateCategory->whereNull('expense_categories.store_location_id')
                        ->whereNotNull('expenses.store_location_id')
                        ->where('expenses.store_location_id', '<>', $targetId);
                });
            })
            ->select([
                'expenses.id as expense_id',
                'expenses.expense_no',
                'expenses.store_location_id as expense_branch_id',
                'expense_categories.id as category_id',
                'expense_categories.store_location_id as category_branch_id',
            ])
            ->orderBy('expenses.id')
            ->get()
            ->map(fn ($conflict) => "Expense {$conflict->expense_no} (#{$conflict->expense_id}), Category #{$conflict->category_id}: Expense Branch "
                .($conflict->expense_branch_id ?? 'NULL').', Category Branch '.($conflict->category_branch_id ?? 'NULL'));

        $duplicateLegacyNames = DB::table('expense_categories')
            ->whereNull('store_location_id')
            ->select('name')
            ->groupBy('name')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('name')
            ->map(fn ($name) => "Multiple legacy NULL Categories are named [{$name}]; assigning both would violate target Branch uniqueness.");

        $targetNameCollisions = DB::table('expense_categories as legacy')
            ->whereNull('legacy.store_location_id')
            ->whereExists(fn ($query) => $query->selectRaw('1')
                ->from('expense_categories as target')
                ->whereColumn('target.name', 'legacy.name')
                ->where('target.store_location_id', $targetId))
            ->distinct()
            ->pluck('legacy.name')
            ->map(fn ($name) => "Legacy NULL Category [{$name}] already exists in the target Branch.");

        $conflicts = $relationshipConflicts->concat($duplicateLegacyNames)->concat($targetNameCollisions)->values();

        return [
            'categories_null' => (clone $categories)->whereNull('store_location_id')->count(),
            'categories_attributed' => (clone $categories)->whereNotNull('store_location_id')->count(),
            'expenses_null' => (clone $expenses)->whereNull('store_location_id')->count(),
            'expenses_attributed' => (clone $expenses)->whereNotNull('store_location_id')->count(),
            'conflicts' => $conflicts,
        ];
    }

    /** @param array<string, mixed> $audit */
    private function report(StoreLocation $branch, array $audit): void
    {
        $this->table(['Target Branch', 'Store Location ID'], [[$branch->code, $branch->id]]);
        $this->table(['Expense Categories', 'Count'], [
            ['Legacy NULL rows', $audit['categories_null']],
            ['Already attributed rows', $audit['categories_attributed']],
        ]);
        $this->table(['Expenses', 'Count'], [
            ['Legacy NULL rows', $audit['expenses_null']],
            ['Already attributed rows', $audit['expenses_attributed']],
        ]);
        $this->line('Potential conflicts: '.$audit['conflicts']->count());
        foreach ($audit['conflicts']->take(20) as $conflict) {
            $this->warn($conflict);
        }
        if ($audit['conflicts']->count() > 20) {
            $this->warn('Only the first 20 conflicts are displayed; review the database for the complete set.');
        }
        $this->line("Would update: {$audit['categories_null']} categories, {$audit['expenses_null']} expenses.");
    }
}
