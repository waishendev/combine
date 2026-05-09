<?php

namespace Tests\Unit;

use App\Services\Reports\SalesReportService;
use PHPUnit\Framework\TestCase;

class SalesReportPaymentMethodVariantsTest extends TestCase
{
    public function testBillplzCardReportRowIncludesOfflineCreditCardPayments(): void
    {
        $variants = SalesReportService::paymentMethodVariantsForMatch('billplz_card');

        $this->assertContains('billplz_card', $variants);
        $this->assertContains('billplz_credit_card', $variants);
        $this->assertContains('credit_card', $variants);
    }
}
