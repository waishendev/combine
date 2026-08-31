<?php

namespace Tests\Unit;

use App\Models\Staff;
use App\Services\Reports\SalesVisualDailyReportService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class StaffSalesReportVisibilityContractTest extends TestCase
{
    public function testStaffPreferenceIsWritableAndBoolean(): void
    {
        $staff = new Staff();

        $this->assertContains('show_in_sales_report', $staff->getFillable());
        $this->assertSame('boolean', $staff->getCasts()['show_in_sales_report']);
    }

    public function testAllThreeStaffSummaryContractsUseTheCanonicalRoster(): void
    {
        $source = file_get_contents((new ReflectionClass(SalesVisualDailyReportService::class))->getFileName());

        $this->assertSame(3, substr_count($source, '$roster = $this->salesReportStaffRoster();'));
        $this->assertStringContainsString("where('st.show_in_sales_report', true)", $source);
        $this->assertStringContainsString("from('staff_store_location as ssl')", $source);
    }

    public function testRosterIsStaffsTableOnlyAndRequiresSalesReportFlag(): void
    {
        $reflection = new ReflectionClass(SalesVisualDailyReportService::class);
        $source = file_get_contents($reflection->getFileName());
        $start = strpos($source, 'private function salesReportStaffRoster');
        $end = strpos($source, 'private function keyRowsByStaffId', $start);
        $rosterSource = substr($source, $start, $end - $start);

        $this->assertStringContainsString("DB::table('staffs as st')", $rosterSource);
        $this->assertStringContainsString("where('st.show_in_sales_report', true)", $rosterSource);
        $this->assertStringNotContainsString('orWhereIn', $rosterSource);
        $this->assertStringNotContainsString('activityStaffIds', $rosterSource);
        $this->assertStringNotContainsString('is_active', $rosterSource);
        $this->assertStringNotContainsString('orders', $rosterSource);
        $this->assertStringNotContainsString('users', $rosterSource);
        $this->assertStringNotContainsString('roles', $rosterSource);
    }
}
