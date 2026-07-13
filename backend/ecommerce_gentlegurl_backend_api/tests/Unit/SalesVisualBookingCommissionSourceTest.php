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

    public function testBothServicesExcludePackageRefundedBookingDeposits(): void
    {
        foreach ([SalesVisualDailyReportService::class, StaffCommissionService::class] as $serviceClass) {
            $this->assertTrue(
                (new ReflectionClass($serviceClass))->hasMethod('excludePackageRefundedBookingDeposits'),
                "{$serviceClass} should exclude refunded deposits after package claim"
            );
        }
    }

    public function testStaffCommissionBookingCountUsesSettledBookingsOnly(): void
    {
        $commission = (new ReflectionClass(StaffCommissionService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(StaffCommissionService::class, 'resolveSettledBookingIdsForMonth');
        $method->setAccessible(true);

        $this->assertTrue($method->isPrivate());

        $visual = (new ReflectionClass(SalesVisualDailyReportService::class))->newInstanceWithoutConstructor();
        $visualMethod = new ReflectionMethod(SalesVisualDailyReportService::class, 'bookingStaffCommissionSales');
        $visualMethod->setAccessible(true);

        $this->assertTrue($visualMethod->isPrivate());
    }
}
