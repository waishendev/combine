<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PickupCheckoutFrontendContractTest extends TestCase
{
    public function test_checkout_uses_server_assessments_and_disables_ineligible_branches(): void
    {
        $checkout = file_get_contents(
            dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_shop/src/components/checkout/CheckoutForm.tsx'
        );
        $client = file_get_contents(
            dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_shop/src/lib/apiClient.ts'
        );

        $this->assertStringContainsString('getPickupStoreLocations({', $checkout);
        $this->assertStringContainsString('disabled={!store.eligible}', $checkout);
        $this->assertStringContainsString('location.id === selected && location.eligible', $checkout);
        $this->assertStringContainsString(': null,', $checkout);
        $this->assertStringNotContainsString('locations[0].id', $checkout);
        $this->assertStringContainsString('/public/shop/checkout/pickup-locations', $client);
    }
}
