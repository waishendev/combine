<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ExpenseBranchBackfillCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_changes_nothing(): void
    {
        $png = $this->branch('PNG');
        [$categoryId, $expenseId] = $this->legacyExpense();

        $this->artisan('expense-branch:backfill', ['--store-code' => $png->code, '--dry-run' => true])
            ->expectsOutputToContain('DRY RUN ONLY')
            ->assertSuccessful();

        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => null]);
        $this->assertDatabaseHas('expenses', ['id' => $expenseId, 'store_location_id' => null]);
    }

    public function test_force_assigns_null_categories_and_expenses_and_is_idempotent(): void
    {
        $png = $this->branch('PNG');
        [$categoryId, $expenseId] = $this->legacyExpense();
        $arguments = ['--store-code' => $png->code, '--force' => true];

        $this->artisan('expense-branch:backfill', $arguments)->assertSuccessful();
        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => $png->id]);
        $this->assertDatabaseHas('expenses', ['id' => $expenseId, 'store_location_id' => $png->id]);

        $this->artisan('expense-branch:backfill', $arguments)
            ->expectsOutputToContain('Expense Branch backfill completed successfully.')
            ->assertSuccessful();
        $this->assertSame(1, DB::table('expense_categories')->whereKey($categoryId)->count());
        $this->assertSame(1, DB::table('expenses')->whereKey($expenseId)->count());
    }

    public function test_force_preserves_existing_non_null_branch_ownership(): void
    {
        $png = $this->branch('PNG');
        $other = $this->branch('OTHER');
        [$categoryId, $expenseId] = $this->legacyExpense($other->id, $other->id);

        $this->artisan('expense-branch:backfill', ['--store-code' => $png->code, '--force' => true])->assertSuccessful();

        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => $other->id]);
        $this->assertDatabaseHas('expenses', ['id' => $expenseId, 'store_location_id' => $other->id]);
    }

    public function test_missing_target_branch_and_unsafe_mode_fail_without_writes(): void
    {
        [$categoryId] = $this->legacyExpense();

        $this->artisan('expense-branch:backfill', ['--store-code' => 'MISSING', '--dry-run' => true])->assertFailed();
        $this->artisan('expense-branch:backfill', ['--store-code' => 'PNG'])->assertFailed();
        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => null]);
    }

    public function test_conflicting_expense_category_branch_is_rejected(): void
    {
        $png = $this->branch('PNG');
        $other = $this->branch('OTHER');
        [$categoryId, $expenseId] = $this->legacyExpense($other->id, null);

        $this->artisan('expense-branch:backfill', ['--store-code' => $png->code, '--force' => true])
            ->expectsOutputToContain('Backfill aborted')
            ->assertFailed();

        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => $other->id]);
        $this->assertDatabaseHas('expenses', ['id' => $expenseId, 'store_location_id' => null]);
    }

    public function test_null_category_is_not_moved_when_an_existing_expense_belongs_to_another_branch(): void
    {
        $png = $this->branch('PNG');
        $other = $this->branch('OTHER');
        [$categoryId, $expenseId] = $this->legacyExpense(null, $other->id);

        $this->artisan('expense-branch:backfill', ['--store-code' => $png->code, '--force' => true])->assertFailed();

        $this->assertDatabaseHas('expense_categories', ['id' => $categoryId, 'store_location_id' => null]);
        $this->assertDatabaseHas('expenses', ['id' => $expenseId, 'store_location_id' => $other->id]);
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create([
            'name' => $code,
            'code' => $code,
            'address_line1' => 'Test',
            'city' => 'Test',
            'state' => 'Test',
            'postcode' => '10000',
            'is_active' => true,
        ]);
    }

    /** @return array{int, int} */
    private function legacyExpense(?int $categoryBranchId = null, ?int $expenseBranchId = null): array
    {
        $now = now();
        $categoryId = DB::table('expense_categories')->insertGetId([
            'store_location_id' => $categoryBranchId,
            'name' => 'Legacy '.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $user = User::factory()->create();
        $expenseId = DB::table('expenses')->insertGetId([
            'store_location_id' => $expenseBranchId,
            'expense_no' => 'EXP-'.uniqid(),
            'expense_category_id' => $categoryId,
            'expense_date' => '2026-08-01',
            'title' => 'Legacy expense',
            'amount' => 10,
            'created_by' => $user->id,
            'updated_by' => $user->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return [$categoryId, $expenseId];
    }
}
