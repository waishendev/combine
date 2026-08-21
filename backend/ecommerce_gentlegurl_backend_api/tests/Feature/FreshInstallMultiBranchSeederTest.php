<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\FreshInstallBranchOneSeeder;
use Database\Seeders\FreshInstallBranchTwoSeeder;
use Database\Seeders\FreshInstallMultiBranchQaDataSeeder;
use Database\Seeders\FreshInstallGlobalQaCatalogSeeder;
use Database\Seeders\FreshInstallSharedBranchAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FreshInstallMultiBranchSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::create(['name' => 'Admin', 'is_active' => true, 'is_system' => false, 'is_default' => true]);
        config()->set('multi_branch.fresh_seed_branches.branch_one', [
            'code' => 'AAA', 'name' => 'Branch AAA', 'admin_email' => 'aaa@example.test', 'admin_username' => 'aaa-admin',
        ]);
        config()->set('multi_branch.fresh_seed_branches.branch_two', [
            'code' => 'CCC', 'name' => 'Branch CCC', 'admin_email' => 'ccc@example.test', 'admin_username' => 'ccc-admin',
        ]);
        config()->set('multi_branch.fresh_seed_admin_password', 'test-password');
        config()->set('multi_branch.fresh_seed_shared_admin', [
            'email' => 'shared@example.test', 'username' => 'shared-admin',
        ]);
    }

    public function test_shared_admin_can_access_both_branches_and_is_idempotent(): void
    {
        config()->set('multi_branch.fresh_seed_profile', 'both');
        $this->seed([FreshInstallBranchOneSeeder::class, FreshInstallBranchTwoSeeder::class]);
        $this->seed(FreshInstallSharedBranchAdminSeeder::class);
        $this->seed(FreshInstallSharedBranchAdminSeeder::class);

        $shared = User::where('email', 'shared@example.test')->firstOrFail();
        $this->assertSame(['AAA', 'CCC'], $shared->storeLocations()->orderBy('code')->pluck('code')->all());
        $this->assertSame(2, DB::table('store_location_user')->where('user_id', $shared->id)->count());
    }

    public function test_shared_admin_only_gets_branch_one_in_single_branch_profile(): void
    {
        config()->set('multi_branch.fresh_seed_profile', 'branch_one');
        $this->seed(FreshInstallBranchOneSeeder::class);
        $this->seed(FreshInstallSharedBranchAdminSeeder::class);

        $shared = User::where('email', 'shared@example.test')->firstOrFail();
        $this->assertSame(['AAA'], $shared->storeLocations()->pluck('code')->all());
    }

    public function test_branch_seeders_create_isolated_admins_and_are_idempotent(): void
    {
        $this->seed([FreshInstallBranchOneSeeder::class, FreshInstallBranchTwoSeeder::class]);
        $this->seed([FreshInstallBranchOneSeeder::class, FreshInstallBranchTwoSeeder::class]);

        $aaa = DB::table('store_locations')->where('code', 'AAA')->first();
        $ccc = DB::table('store_locations')->where('code', 'CCC')->first();
        $aaaAdmin = User::where('email', 'aaa@example.test')->firstOrFail();
        $cccAdmin = User::where('email', 'ccc@example.test')->firstOrFail();

        $this->assertSame(2, DB::table('store_locations')->count());
        $this->assertSame([$aaa->id], $aaaAdmin->storeLocations()->pluck('store_locations.id')->all());
        $this->assertSame([$ccc->id], $cccAdmin->storeLocations()->pluck('store_locations.id')->all());
    }

    public function test_qa_data_seeder_prepares_each_configured_branch_without_duplicating_products(): void
    {
        $this->seed([FreshInstallBranchOneSeeder::class, FreshInstallBranchTwoSeeder::class]);
        User::factory()->create();
        foreach (range(1, 3) as $index) {
            DB::table('products')->insert(['name' => "Product {$index}", 'slug' => "product-{$index}",
                'sku' => "PRODUCT-{$index}", 'price' => 10, 'stock' => 10, 'low_stock_threshold' => 5,
                'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        config()->set('multi_branch.fresh_seed_profile', 'both');
        config()->set('multi_branch.fresh_seed_qa_data', true);

        $this->seed(FreshInstallMultiBranchQaDataSeeder::class);
        $this->seed(FreshInstallMultiBranchQaDataSeeder::class);

        $this->assertSame(3, DB::table('products')->count());
        $this->assertSame(6, DB::table('expense_categories')->count());
        $this->assertSame(12, DB::table('expenses')->count());
        $this->assertSame(4, DB::table('store_location_product')->count());
    }

    public function test_global_qa_catalog_is_single_copy_and_idempotent(): void
    {
        config()->set('multi_branch.fresh_seed_qa_data', true);
        $this->seed(FreshInstallGlobalQaCatalogSeeder::class);
        $this->seed(FreshInstallGlobalQaCatalogSeeder::class);

        $this->assertSame(9, DB::table('products')->where('sku', 'like', 'MBQA-GLOBAL-%')->count());
        $this->assertSame(3, DB::table('categories')->where('slug', 'like', 'mbqa-%')->count());
        $this->assertSame(3, DB::table('staffs')->where('code', 'like', 'MBQA-STAFF-%')->count());
        $this->assertSame(3, DB::table('booking_services')->where('name', 'like', 'MBQA Service %')->count());
    }
}
