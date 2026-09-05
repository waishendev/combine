<?php

namespace Tests\Unit;

use Tests\TestCase;

class BookingShopSlotContractTest extends TestCase
{
    public function test_slot_page_sends_branch_contract_and_renders_visible_slots(): void
    {
        $client = file_get_contents(base_path('../../frontend/booking_gentlegurl_shop/src/lib/apiClient.ts'));
        $page = file_get_contents(base_path('../../frontend/booking_gentlegurl_shop/src/app/booking/service/[id]/slots/page.tsx'));

        $this->assertStringContainsString('`/booking/availability/pooled?${qs.toString()}`', $client);
        $this->assertStringContainsString('qs.set("service_id", serviceId)', $client);
        $this->assertStringContainsString('qs.set("date", date)', $client);
        $this->assertStringContainsString('qs.set("store_location_id", String(storeLocationId))', $client);
        $this->assertStringContainsString('payload?.visible_slots', $page);
        $this->assertStringContainsString('setSlots(visibleSlots)', $page);
        $this->assertStringContainsString('formatTime(slot.start_at ?? slot.start_time ?? "")', $page);
    }
}
