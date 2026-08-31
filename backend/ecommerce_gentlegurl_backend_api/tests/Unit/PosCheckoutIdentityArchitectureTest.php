<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PosCheckoutIdentityArchitectureTest extends TestCase
{
    public function test_checkout_member_and_booking_line_identity_have_separate_sources(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');

        $this->assertStringContainsString("'customer_id' => \$customerId,", $source, 'Order must use checkout member.');
        $this->assertStringContainsString("'customer_id' => \$serviceItem->customer_id ? (int) \$serviceItem->customer_id : null,", $source, 'Booking must use line identity.');

        $syncStart = strpos($source, 'public function syncCustomerContext');
        $syncEnd = strpos($source, 'public function bookService', $syncStart);
        $syncMethod = substr($source, $syncStart, $syncEnd - $syncStart);
        $this->assertStringNotContainsString("'customer_id' => \$memberId", $syncMethod);
        $this->assertStringNotContainsString("'customer_id' => null", $syncMethod);
    }
}
