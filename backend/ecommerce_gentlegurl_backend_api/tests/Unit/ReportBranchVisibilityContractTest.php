<?php

namespace Tests\Unit;

use Tests\TestCase;

class ReportBranchVisibilityContractTest extends TestCase
{
    public function test_cash_shift_report_uses_persisted_shift_branch_without_n_plus_one(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Ecommerce/PosCashShiftController.php'));

        $this->assertStringContainsString("'storeLocation:id,name,code'", $controller);
        $this->assertStringContainsString("'store_location_id' => \$shift->store_location_id", $controller);
        $this->assertStringContainsString("'store_location' => \$shift->storeLocation", $controller);
        $this->assertStringContainsString("->whereIn('store_location_id', \$accessibleIds)->orWhereNull('store_location_id')", $controller);
    }

    public function test_product_profit_all_grain_uses_order_branch_and_preserves_scope_summary(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Ecommerce/Reports/ProductProfitReportController.php'));

        $this->assertStringContainsString("ReportBranchScope::applyCurrent(DB::table('order_items as oi'), 'o.store_location_id')", $controller);
        $this->assertStringContainsString("'o.store_location_id', 'sl.name', 'sl.code'", $controller);
        $this->assertStringContainsString("'row_grain' => \$isAllBranches ? 'store_location_product_variant' : 'product_variant'", $controller);
        $this->assertStringContainsString("\$summaryRaw = (clone \$baseItems)", $controller);
        $this->assertStringContainsString("COALESCE(oi.cost_amount_snapshot, 0)", $controller);
    }

    public function test_frontend_tables_conditionally_render_branch_and_adjust_colspans(): void
    {
        $cash = file_get_contents(base_path('../frontend/ecommerce_gentlegurl_crm/src/components/reports/CashShiftReportPage.tsx'));
        $profit = file_get_contents(base_path('../frontend/ecommerce_gentlegurl_crm/src/components/reports/ProductProfitReportPage.tsx'));

        foreach ([$cash, $profit] as $page) {
            $this->assertStringContainsString('const isAllBranches = selectedBranchId === null', $page);
            $this->assertStringContainsString("'Unassigned'", $page);
        }
        $this->assertStringContainsString("? [...baseTableHeadings.slice(0, 2), 'Branch'", $cash);
        $this->assertStringContainsString('colSpan={tableHeadings.length}', $cash);
        $this->assertStringContainsString('colSpan={tableColumnCount}', $profit);
    }
}
