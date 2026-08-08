<?php

namespace Database\Seeders;

use App\Models\Booking\BookingService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use Illuminate\Database\Seeder;
use RuntimeException;

class BookingBranchAssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $branch = StoreLocation::query()->where('code', config('multi_branch.fresh_install_store_code'))
            ->where('is_active', true)->first();
        if (! $branch) {
            throw new RuntimeException('Configured fresh-install Branch does not exist or is inactive.');
        }
        Staff::query()->eachById(fn (Staff $staff) => $staff->storeLocations()->syncWithoutDetaching([$branch->id]));
        BookingService::query()->eachById(fn (BookingService $service) => $service->storeLocations()->syncWithoutDetaching([$branch->id]));
    }
}
