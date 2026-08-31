<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Services\PosPaymentMethodService;
use Illuminate\Database\Seeder;
use RuntimeException;

class FreshInstallPosPaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        $code = (string) config('multi_branch.fresh_install_store_code');
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            throw new RuntimeException("Configured default Branch [{$code}] was not found.");
        }

        // Missing-only is crucial: normal db:seed must preserve operator changes.
        app(PosPaymentMethodService::class)->initializeBranch((int) $branch->id);
    }
}
