<?php

namespace App\Services;

use App\Models\Staff;
use App\Models\User;

/**
 * Additively aligns a linked user's canonical Branch access with Work At.
 *
 * store_location_user does not record an ownership/source, so access which is
 * no longer represented by Work At cannot safely be removed here: it may have
 * been granted manually or for an administrative role.
 */
class StaffBranchAccessService
{
    /** @return array<int> IDs inserted into store_location_user. */
    public function synchronize(Staff $staff, ?User $user = null): array
    {
        $user ??= $staff->admin()->first();
        if (! $user) {
            return [];
        }

        $assigned = $staff->storeLocations()->pluck('store_locations.id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $existing = $user->storeLocations()->whereIn('store_locations.id', $assigned)
            ->pluck('store_locations.id')
            ->map(fn ($id) => (int) $id);
        $missing = $assigned->diff($existing)->values()->all();

        if ($missing !== []) {
            $user->storeLocations()->syncWithoutDetaching($missing);
        }

        return $missing;
    }
}
