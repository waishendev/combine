<?php

namespace Tests\Unit;

use App\Services\Booking\BookingAvailabilityService;
use PHPUnit\Framework\TestCase;

class BookingAvailabilityBlockingStatusesTest extends TestCase
{
    public function test_completed_and_terminal_statuses_do_not_block_slots(): void
    {
        $blockingStatuses = BookingAvailabilityService::BLOCKING_BOOKING_STATUSES;

        $this->assertNotContains('COMPLETED', $blockingStatuses);
        $this->assertNotContains('CANCELLED', $blockingStatuses);
        $this->assertNotContains('NOTIFIED_CANCELLATION', $blockingStatuses);
        $this->assertNotContains('LATE_CANCELLATION', $blockingStatuses);
        $this->assertNotContains('NO_SHOW', $blockingStatuses);
        $this->assertNotContains('EXPIRED', $blockingStatuses);
        $this->assertNotContains('VOIDED', $blockingStatuses);
    }

    public function test_active_operational_statuses_block_slots(): void
    {
        $blockingStatuses = BookingAvailabilityService::BLOCKING_BOOKING_STATUSES;

        $this->assertContains('HOLD', $blockingStatuses);
        $this->assertContains('CONFIRMED', $blockingStatuses);
        $this->assertContains('IN_PROGRESS', $blockingStatuses);
        $this->assertContains('CHECKED_IN', $blockingStatuses);
    }
}
