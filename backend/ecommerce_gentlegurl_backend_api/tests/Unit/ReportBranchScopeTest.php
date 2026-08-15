<?php

namespace Tests\Unit;

use App\Services\Reports\ReportBranchScope;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportBranchScopeTest extends TestCase
{
    public function test_specific_branch_never_includes_unassigned(): void
    {
        $query = (new ReportBranchScope([12], 12, false))->apply(DB::table('orders'), 'orders.store_location_id');
        $this->assertStringNotContainsString('is null', $query->toSql());
        $this->assertSame([12], $query->getBindings());
    }

    public function test_all_branches_uses_only_accessible_ids_and_explicit_unassigned(): void
    {
        $query = (new ReportBranchScope([4, 9], null, true))->apply(DB::table('orders'), 'orders.store_location_id');
        $this->assertStringContainsString('is null', $query->toSql());
        $this->assertSame([4, 9], $query->getBindings());
    }
}
