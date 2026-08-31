<?php

namespace Tests\Unit;

use App\Support\PosSettlementCustomerIdentity;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PosSettlementCustomerIdentityTest extends TestCase
{
    public static function compatibilityMatrix(): array
    {
        return [
            'guest + guest' => [[null, null], false],
            'guests with unrelated contact snapshots remain null identities' => [[null, null, null], false],
            'guest + member A' => [[null, 10], false],
            'member A + guest' => [[10, null], false],
            'member A + member A' => [[10, 10], false],
            'member A + guest + guest' => [[10, null, null], false],
            'member A + member B' => [[10, 20], true],
            'member A + member B + guest' => [[10, 20, null], true],
            'three members' => [[10, 20, 30], true],
        ];
    }

    #[DataProvider('compatibilityMatrix')]
    public function test_distinct_non_null_member_rule(array $customerIds, bool $conflicts): void
    {
        $this->assertSame($conflicts, PosSettlementCustomerIdentity::hasConflict($customerIds));
    }

    public function test_error_does_not_misdescribe_guests_as_conflicts(): void
    {
        $this->assertSame(
            'Bookings belonging to different Members cannot be settled together.',
            PosSettlementCustomerIdentity::CONFLICT_MESSAGE,
        );
    }
}
