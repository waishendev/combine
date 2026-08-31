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

        $this->assertSame(3, substr_count($source, 'salesReportStaffRoster(array_unique(array_merge(array_keys($ecKeyed), array_keys($svcKeyed))))'));
        $this->assertStringContainsString("where('st.show_in_sales_report', true)", $source);
        $this->assertStringContainsString("orWhereIn('st.id', \$activityStaffIds)", $source);
        $this->assertStringContainsString("from('staff_store_location as ssl')", $source);
    }

    public function testRosterDoesNotUseActiveStatusOrFilterTransactions(): void
    {
        $reflection = new ReflectionClass(SalesVisualDailyReportService::class);
        $source = file_get_contents($reflection->getFileName());
        $start = strpos($source, 'private function salesReportStaffRoster');
        $end = strpos($source, 'private function keyRowsByStaffId', $start);
        $rosterSource = substr($source, $start, $end - $start);

        $this->assertStringNotContainsString('is_active', $rosterSource);
        $this->assertStringNotContainsString('orders', $rosterSource);
    }
}
