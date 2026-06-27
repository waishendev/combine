<?php

namespace Tests\Unit;

use App\Services\Booking\StaffCommissionService;
use App\Services\Reports\SalesVisualDailyReportService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class SalesVisualBookingCommissionSourceTest extends TestCase
{
    public function testSalesVisualUsesStaffCommissionBookingLineAmountExpression(): void
    {
        $visual = (new ReflectionClass(SalesVisualDailyReportService::class))->newInstanceWithoutConstructor();
        $visualMethod = new ReflectionMethod(SalesVisualDailyReportService::class, 'effectiveBookingLineTotalExpr');
        $visualMethod->setAccessible(true);

        $commission = (new ReflectionClass(StaffCommissionService::class))->newInstanceWithoutConstructor();
        $commissionMethod = new ReflectionMethod(StaffCommissionService::class, 'effectiveLineTotalExpr');
        $commissionMethod->setAccessible(true);

        $this->assertSame(
            $commissionMethod->invoke($commission),
            $visualMethod->invoke($visual)
        );
    }
}
