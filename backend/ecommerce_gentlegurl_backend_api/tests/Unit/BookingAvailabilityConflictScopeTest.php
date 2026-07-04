<?php

namespace Tests\Unit;

use App\Services\Booking\BookingAvailabilityService;
use PHPUnit\Framework\TestCase;

class BookingAvailabilityConflictScopeTest extends TestCase
{
    public function test_customer_scope_constant_is_distinct_from_crm_scope(): void
    {
        $this->assertSame('customer', BookingAvailabilityService::SCOPE_CUSTOMER);
        $this->assertSame('crm', BookingAvailabilityService::SCOPE_CRM);
        $this->assertNotSame(
            BookingAvailabilityService::SCOPE_CUSTOMER,
            BookingAvailabilityService::SCOPE_CRM,
        );
    }

    public function test_crm_scope_is_the_pos_default_for_pooled_availability(): void
    {
        $reflection = new \ReflectionMethod(BookingAvailabilityService::class, 'getPosPooledAvailabilitySlots');
        $scopeParameter = null;

        foreach ($reflection->getParameters() as $parameter) {
            if ($parameter->getName() === 'conflictScope') {
                $scopeParameter = $parameter;
                break;
            }
        }

        $this->assertNotNull($scopeParameter);
        $this->assertTrue($scopeParameter->isDefaultValueAvailable());
        $this->assertSame(BookingAvailabilityService::SCOPE_CRM, $scopeParameter->getDefaultValue());
    }
}
