<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Services\BranchAccessBackfillService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BranchAccessDefaultStoreLocationSeeder extends Seeder
{
    private const FRESH_INSTALL_STORE_CODE = 'PNG';

    public function run(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('store_location_user')) {
            throw new RuntimeException('The store_location_user table does not exist. Run php artisan migrate before this seeder.');
        }

        $storeLocation = StoreLocation::query()
            ->where('code', self::FRESH_INSTALL_STORE_CODE)
            ->where('is_active', true)
            ->first();

        if (! $storeLocation) {
            throw new RuntimeException('Unable to find the fresh-install default active StoreLocation with code ['.self::FRESH_INSTALL_STORE_CODE.'].');
        }

        app(BranchAccessBackfillService::class)->backfill($storeLocation);
    }
}
