<?php

namespace App\Support;

final class PosSettlementCustomerIdentity
{
    public const CONFLICT_MESSAGE = 'Bookings belonging to different Members cannot be settled together.';

    /**
     * Guest bookings have a null customer id and therefore do not introduce a
     * member conflict. Contact snapshots are deliberately not identity keys.
     *
     * @param  iterable<mixed>  $customerIds
     * @return array<int>
     */
    public static function distinctMemberIds(iterable $customerIds): array
    {
        $ids = [];

        foreach ($customerIds as $customerId) {
            $id = (int) ($customerId ?? 0);
            if ($id > 0) {
                $ids[$id] = $id;
            }
        }

        return array_values($ids);
    }

    public static function hasConflict(iterable $customerIds): bool
    {
        return count(self::distinctMemberIds($customerIds)) > 1;
    }
}
