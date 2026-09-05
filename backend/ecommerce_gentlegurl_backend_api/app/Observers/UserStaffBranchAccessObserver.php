<?php

namespace App\Observers;

use App\Models\User;
use App\Services\StaffBranchAccessService;

class UserStaffBranchAccessObserver
{
    public function saved(User $user): void
    {
        if ($user->staff_id && ($user->wasRecentlyCreated || $user->wasChanged('staff_id'))) {
            $staff = $user->staff()->first();
            if ($staff) {
                app(StaffBranchAccessService::class)->synchronize($staff, $user);
            }
        }
    }
}
