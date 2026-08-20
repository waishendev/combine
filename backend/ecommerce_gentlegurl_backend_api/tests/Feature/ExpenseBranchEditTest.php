<?php

namespace Tests\Feature;

use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\ExpenseController;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ExpenseBranchEditTest extends TestCase
{
    use RefreshDatabase;

    public function test_specific_branch_expense_edit_cannot_change_branch(): void
    {
        [$user, $a, $b] = $this->actorWithBranches();
        $expense = $this->expense($user, $a, $this->category($a, 'A'));

        $this->expectException(ValidationException::class);
        app(ExpenseController::class)->update(
            $this->request($user, $this->expensePayload($b, $this->category($b, 'B')), $a),
            $expense,
        );
    }

    public function test_all_branches_authorized_expense_move_requires_target_category_and_then_succeeds(): void
    {
        [$user, $a, $b] = $this->actorWithBranches();
        $categoryA = $this->category($a, 'A');
        $categoryB = $this->category($b, 'B');
        $expense = $this->expense($user, $a, $categoryA);

        try {
            app(ExpenseController::class)->update($this->request($user, $this->expensePayload($b, $categoryA)), $expense);
            $this->fail('The old Branch Category should be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('expense_category_id', $exception->errors());
        }

        app(ExpenseController::class)->update($this->request($user, $this->expensePayload($b, $categoryB)), $expense->fresh());
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'store_location_id' => $b->id,
            'expense_category_id' => $categoryB->id,
        ]);
    }

    public function test_expense_cannot_move_to_an_inaccessible_branch(): void
    {
        [$user, $a] = $this->actorWithBranches(false);
        $b = $this->branch('B');
        $expense = $this->expense($user, $a, $this->category($a, 'A'));

        $this->expectException(HttpException::class);
        app(ExpenseController::class)->update($this->request($user, $this->expensePayload($b, $this->category($b, 'B'))), $expense);
    }

    public function test_specific_branch_category_edit_cannot_move_branch(): void
    {
        [$user, $a, $b] = $this->actorWithBranches();
        $category = $this->category($a, 'A');

        $this->expectException(ValidationException::class);
        app(ExpenseCategoryController::class)->update(
            $this->request($user, $this->categoryPayload($category, $b), $a),
            $category,
        );
    }

    public function test_all_branches_unused_category_can_move_but_used_category_cannot(): void
    {
        [$user, $a, $b] = $this->actorWithBranches();
        $unused = $this->category($a, 'Unused');
        app(ExpenseCategoryController::class)->update($this->request($user, $this->categoryPayload($unused, $b)), $unused);
        $this->assertDatabaseHas('expense_categories', ['id' => $unused->id, 'store_location_id' => $b->id]);

        $used = $this->category($a, 'Used');
        $this->expense($user, $a, $used);
        try {
            app(ExpenseCategoryController::class)->update($this->request($user, $this->categoryPayload($used, $b)), $used);
            $this->fail('A used Category should not move.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('store_location_id', $exception->errors());
        }
        $this->assertDatabaseHas('expense_categories', ['id' => $used->id, 'store_location_id' => $a->id]);
    }

    public function test_category_cannot_move_to_inaccessible_branch_and_legacy_is_never_implicitly_assigned(): void
    {
        [$user, $a] = $this->actorWithBranches(false);
        $b = $this->branch('B');
        $category = $this->category($a, 'Protected');

        try {
            app(ExpenseCategoryController::class)->update($this->request($user, $this->categoryPayload($category, $b)), $category);
            $this->fail('An inaccessible target Branch should be rejected.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }

        $legacy = $this->category(null, 'Legacy');
        try {
            app(ExpenseCategoryController::class)->update(
                $this->request($user, ['name' => $legacy->name, 'description' => null, 'is_active' => true]),
                $legacy,
            );
            $this->fail('Legacy ownership must require an explicit Branch.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('store_location_id', $exception->errors());
        }
        $this->assertDatabaseHas('expense_categories', ['id' => $legacy->id, 'store_location_id' => null]);
    }

    public function test_legacy_expense_requires_explicit_authorized_branch_and_matching_category(): void
    {
        [$user, $a] = $this->actorWithBranches(false);
        $legacyCategory = $this->category(null, 'Legacy Expense Category');
        $legacyExpense = Expense::create([
            'store_location_id' => null,
            'expense_no' => 'EXP-LEGACY',
            'expense_category_id' => $legacyCategory->id,
            'expense_date' => '2026-08-20',
            'title' => 'Legacy',
            'amount' => 10,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        try {
            app(ExpenseController::class)->update($this->request($user, [
                'expense_category_id' => $legacyCategory->id,
                'expense_date' => '2026-08-20',
                'title' => 'Legacy',
                'amount' => '10.00',
            ]), $legacyExpense);
            $this->fail('Legacy Expense ownership must not be inferred.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('store_location_id', $exception->errors());
        }

        $targetCategory = $this->category($a, 'Target');
        app(ExpenseController::class)->update($this->request($user, $this->expensePayload($a, $targetCategory)), $legacyExpense);
        $this->assertDatabaseHas('expenses', ['id' => $legacyExpense->id, 'store_location_id' => $a->id, 'expense_category_id' => $targetCategory->id]);
    }

    private function request(User $user, array $payload, ?StoreLocation $specific = null): Request
    {
        $url = '/expenses'.($specific ? '?branch_store_location_id='.$specific->id : '');
        $request = Request::create($url, 'PUT', $payload);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function expensePayload(StoreLocation $branch, ExpenseCategory $category): array
    {
        return ['store_location_id' => $branch->id, 'expense_category_id' => $category->id, 'expense_date' => '2026-08-20', 'title' => 'Edited', 'amount' => '12.00'];
    }

    private function categoryPayload(ExpenseCategory $category, StoreLocation $branch): array
    {
        return ['store_location_id' => $branch->id, 'name' => $category->name, 'description' => null, 'is_active' => true];
    }

    private function actorWithBranches(bool $includeB = true): array
    {
        $user = User::factory()->create();
        $a = $this->branch('A');
        $branches = [$a->id];
        $result = [$user, $a];
        if ($includeB) {
            $b = $this->branch('B');
            $branches[] = $b->id;
            $result[] = $b;
        }
        $user->storeLocations()->sync($branches);

        return $result;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true]);
    }

    private function category(?StoreLocation $branch, string $name): ExpenseCategory
    {
        return ExpenseCategory::create(['store_location_id' => $branch?->id, 'name' => $name, 'sort_order' => 1, 'is_active' => true]);
    }

    private function expense(User $user, StoreLocation $branch, ExpenseCategory $category): Expense
    {
        return Expense::create(['store_location_id' => $branch->id, 'expense_no' => 'EXP-'.uniqid(), 'expense_category_id' => $category->id, 'expense_date' => '2026-08-20', 'title' => 'Expense', 'amount' => 10, 'created_by' => $user->id, 'updated_by' => $user->id]);
    }
}
