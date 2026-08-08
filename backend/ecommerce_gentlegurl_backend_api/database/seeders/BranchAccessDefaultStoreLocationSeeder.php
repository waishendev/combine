<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Services\BranchAccessBackfillService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BranchAccessDefaultStoreLocationSeeder extends Seeder
{
    public function run(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('store_location_user')) {
            throw new RuntimeException('The store_location_user table does not exist. Run php artisan migrate before this seeder.');
        }

        $storeLocation = StoreLocation::query()
            ->where('code', config('multi_branch.fresh_install_store_code'))
            ->where('is_active', true)
            ->first();

        if (! $storeLocation) {
            throw new RuntimeException('Unable to find the configured fresh-install default active StoreLocation.');
        }

        app(BranchAccessBackfillService::class)->backfill($storeLocation);
    }
}
