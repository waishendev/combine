<?php

namespace Tests\Unit;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseBranchScope;
use Tests\TestCase;

class ExpenseBranchScopeTest extends TestCase
{
    public function test_specific_branch_filters_expenses_and_excludes_legacy_unassigned(): void
    {
        $query = (new ExpenseBranchScope([12], 12, false))->apply(Expense::query());

        $this->assertStringNotContainsString('is null', $query->toSql());
        $this->assertSame([12], $query->getBindings());
    }

    public function test_all_branches_filters_to_accessible_branches_and_explicitly_includes_legacy_unassigned(): void
    {
        $query = (new ExpenseBranchScope([4, 9], null, true))->apply(Expense::query());

        $this->assertStringContainsString('is null', $query->toSql());
        $this->assertSame([4, 9], $query->getBindings());
    }

    public function test_category_scope_uses_the_same_branch_boundary(): void
    {
        $query = (new ExpenseBranchScope([7], 7, false))->apply(ExpenseCategory::query());

        $this->assertStringNotContainsString('is null', $query->toSql());
        $this->assertSame([7], $query->getBindings());
    }
}
