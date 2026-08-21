<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Services\MultiBranchQaTestSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class FreshInstallMultiBranchQaDataSeeder extends Seeder
{
    public function run(MultiBranchQaTestSeeder $seeder): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('Fresh-install Multi-Branch QA data cannot run in production.');
        }

        if (! config('multi_branch.fresh_seed_qa_data')) {
            $this->command?->warn('Fresh-install Multi-Branch QA data is disabled.');
            return;
        }

        $profile = config('multi_branch.fresh_seed_profile');
        if (! in_array($profile, ['branch_one', 'both'], true)) {
            throw new RuntimeException('MULTI_BRANCH_SEED_PROFILE must be branch_one or both.');
        }
        $slots = $profile === 'branch_one'
            ? ['branch_one']
            : ['branch_one', 'branch_two'];

        foreach ($slots as $slot) {
            $code = config("multi_branch.fresh_seed_branches.{$slot}.code");
            $branch = StoreLocation::query()->where('code', $code)->firstOrFail();
            $audit = $seeder->audit($branch);
            $result = $seeder->seed($branch, $audit);
            $this->command?->info("Prepared {$branch->code}: {$result['created']} created, {$result['existing']} existing.");
            foreach ($audit['warnings'] as $warning) {
                $this->command?->warn("{$branch->code}: {$warning}");
            }
        }

        if ($profile === 'both') {
            $this->applyOwnedIsolationControls();
        }
    }

    private function applyOwnedIsolationControls(): void
    {
        $one = StoreLocation::query()->where('code', config('multi_branch.fresh_seed_branches.branch_one.code'))->firstOrFail();
        $two = StoreLocation::query()->where('code', config('multi_branch.fresh_seed_branches.branch_two.code'))->firstOrFail();

        $productOneOnly = DB::table('products')->where('sku', 'MBQA-GLOBAL-002')->value('id');
        $productTwoOnly = DB::table('products')->where('sku', 'MBQA-GLOBAL-003')->value('id');
        if ($productOneOnly && $productTwoOnly) {
            DB::table('store_location_product')->where(['store_location_id' => $two->id, 'product_id' => $productOneOnly])
                ->update(['is_available' => false, 'updated_at' => now()]);
            DB::table('store_location_product')->where(['store_location_id' => $one->id, 'product_id' => $productTwoOnly])
                ->update(['is_available' => false, 'updated_at' => now()]);
        }

        $staffOneOnly = DB::table('staffs')->where('code', 'MBQA-STAFF-002')->value('id');
        $staffTwoOnly = DB::table('staffs')->where('code', 'MBQA-STAFF-003')->value('id');
        DB::table('staff_store_location')->where(['store_location_id' => $two->id, 'staff_id' => $staffOneOnly])->delete();
        DB::table('staff_store_location')->where(['store_location_id' => $one->id, 'staff_id' => $staffTwoOnly])->delete();

        $serviceOneOnly = DB::table('booking_services')->where('name', 'MBQA Service 2')->value('id');
        $serviceTwoOnly = DB::table('booking_services')->where('name', 'MBQA Service 3')->value('id');
        DB::table('booking_service_store_location')->where(['store_location_id' => $two->id, 'booking_service_id' => $serviceOneOnly])->delete();
        DB::table('booking_service_store_location')->where(['store_location_id' => $one->id, 'booking_service_id' => $serviceTwoOnly])->delete();
    }
}
