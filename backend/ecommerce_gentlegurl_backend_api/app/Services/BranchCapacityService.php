<?php

namespace App\Services;

use App\Models\Ecommerce\StoreLocation;

class BranchCapacityService
{
    public const SETTING_KEY = 'branch_limit';
    public const DEFAULT_LIMIT = 2;

    public function limit(): int
    {
        return max(1, (int) SettingService::get(self::SETTING_KEY, self::DEFAULT_LIMIT));
    }

    /**
     * @param  int|null  $knownCount  When provided (e.g. unfiltered paginator total), skips a second COUNT(*).
     */
    public function usage(?int $knownCount = null): array
    {
        $count = $knownCount ?? StoreLocation::query()->count();
        $limit = $this->limit();

        return [
            'count' => $count,
            'limit' => $limit,
            'can_create' => $count < $limit,
        ];
    }
}
