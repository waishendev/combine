<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class PosAppointmentCalendarArchitectureTest extends TestCase
{
    public function test_calendar_feed_is_sql_paginated_and_does_not_run_heavyweight_enrichment(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');
        $start = strpos($source, 'public function appointmentCalendar');
        $end = strpos($source, 'protected function runAppointmentSearch', $start);
        $method = substr($source, $start, $end - $start);

        $this->assertStringContainsString('->paginate($perPage', $method);
        $this->assertStringContainsString("'financial_calculations' => 0", $method);
        $this->assertStringNotContainsString('resolveAppointmentFinancialSummary(', $method);
        $this->assertStringNotContainsString('resolveAppointmentVisitCheckoutMeta(', $method);
        $this->assertStringNotContainsString('preloadAppointmentSearchActiveOrderItems(', $method);
    }

    public function test_calendar_index_matches_branch_range_and_order_path(): void
    {
        $migration = file_get_contents(__DIR__.'/../../database/migrations/2027_03_02_000100_add_pos_appointment_calendar_scope_index.php');

        $this->assertStringContainsString("['store_location_id', 'start_at', 'id']", $migration);
    }

    public function test_calendar_financial_tone_keeps_reserved_package_operational(): void
    {
        $controller = (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod($controller, 'appointmentCalendarFinancialTone');
        $method->setAccessible(true);

        $paid = $method->invoke($controller, 'PAID', 'consumed');
        $reserved = $method->invoke($controller, 'PAID', 'reserved');
        $unpaid = $method->invoke($controller, 'UNPAID', null);

        $this->assertSame(['payment_status' => 'PAID', 'balance_due' => 0.0, 'amount_due_now' => 0.0, 'settlement_paid' => 1.0], $paid);
        $this->assertSame(0.0, $reserved['amount_due_now']);
        $this->assertSame(0.0, $reserved['settlement_paid']);
        $this->assertSame('UNPAID', $unpaid['payment_status']);
    }
}
