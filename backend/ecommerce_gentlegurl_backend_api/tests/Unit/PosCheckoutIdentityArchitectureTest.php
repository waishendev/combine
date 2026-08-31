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

    public function test_settlement_list_add_and_checkout_share_backend_policy(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');
        $frontend = file_get_contents(__DIR__.'/../../../../frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');

        $this->assertStringContainsString("'can_add_to_settlement_cart'", $source);
        $this->assertStringContainsString('PosSettlementCustomerIdentity::hasConflict($prospectiveMemberIds)', $source);
        $this->assertStringContainsString('if ($settlementCustomerIds->count() > 1)', $source);
        $this->assertStringContainsString('appt.can_add_to_settlement_cart === false', $frontend);
        $this->assertStringNotContainsString('Member booking services in cart'.' — guest settlement cannot be added.', $frontend);
        $this->assertStringNotContainsString('Guest booking services in cart'.' — member settlement cannot be added.', $frontend);
        $this->assertStringNotContainsString('posGuestIdentityKeysCompatible(cartGuestServiceKey, apptGuestKey)', $frontend);
    }

    public function test_checkout_lock_depends_on_a_concrete_settlement_member(): void
    {
        $frontend = file_get_contents(__DIR__.'/../../../../frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');

        $this->assertStringContainsString('const checkoutRequiresMemberOnly = hasCartPackages || cartMemberServiceCustomerIds.size > 0 || settlementLockedCustomerId !== null', $frontend);
        $this->assertStringContainsString('hasCartAppointmentSettlements && settlementLockedCustomerId === null', $frontend);
        $this->assertStringContainsString('disabled={Boolean(settlementLockedCustomerId)}', $frontend);
        $this->assertStringContainsString('member.id !== settlementLockedCustomerId', $frontend);
        $this->assertStringNotContainsString('all booking lines will update'.' to match', $frontend);
        $this->assertStringNotContainsString('Settlement is in the cart — customer is locked'.' to', $frontend);
    }
}
