<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MultiBranchQaTestSeederCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_requires_code_known_branch_and_explicit_mode(): void
    {
        $this->artisan('multibranch:test-seed', ['--dry-run' => true])->assertFailed();
        $this->artisan('multibranch:test-seed', ['--store-code' => 'MISSING', '--dry-run' => true])
            ->expectsOutputToContain('Target Branch not found')->assertFailed();
        $this->artisan('multibranch:test-seed', ['--store-code' => $this->branch('TARGET')->code])->assertFailed();
    }

    public function test_dry_run_is_read_only(): void
    {
        $target = $this->branch('TARGET');
        $this->products();
        $before = $this->counts();

        $this->artisan('multibranch:test-seed', ['--store-code' => $target->code, '--dry-run' => true])
            ->expectsOutputToContain('DRY RUN ONLY — NO DATA CHANGED')->assertSuccessful();

        $this->assertSame($before, $this->counts());
    }

    public function test_force_is_branch_isolated_reuses_global_identity_and_is_idempotent(): void
    {
        User::factory()->create();
        $png = $this->branch('PNG');
        $target = $this->branch('BRANCH2');
        $productIds = $this->products();
        DB::table('store_location_product')->insert(['store_location_id' => $png->id, 'product_id' => $productIds[0],
            'is_available' => true, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('store_location_product_inventories')->insert(['store_location_id' => $png->id,
            'product_id' => $productIds[0], 'product_variant_id' => null, 'quantity' => 50,
            'created_at' => now(), 'updated_at' => now()]);
        $globalProducts = DB::table('products')->count();

        $arguments = ['--store-code' => $target->code, '--force' => true];
        $this->artisan('multibranch:test-seed', $arguments)->assertSuccessful();
        $first = $this->counts();
        $this->artisan('multibranch:test-seed', $arguments)->assertSuccessful();

        $this->assertSame($first, $this->counts());
        $this->assertSame($globalProducts, DB::table('products')->count());
        $this->assertDatabaseHas('store_location_product_inventories', ['store_location_id' => $png->id,
            'product_id' => $productIds[0], 'quantity' => 50]);
        $this->assertDatabaseHas('store_location_product', ['store_location_id' => $target->id,
            'product_id' => $productIds[0], 'is_available' => true]);
        $this->assertDatabaseHas('store_location_product_inventories', ['store_location_id' => $target->id,
            'quantity' => 2]);
        $this->assertSame(0, DB::table('expenses')->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->where('expenses.store_location_id', $target->id)
            ->whereColumn('expenses.store_location_id', '<>', 'expense_categories.store_location_id')->count());
    }

    public function test_production_is_rejected(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $this->artisan('multibranch:test-seed', ['--store-code' => 'ANY', '--dry-run' => true])
            ->expectsOutputToContain('cannot run in production')->assertFailed();
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'QA', 'city' => 'QA',
            'state' => 'QA', 'postcode' => '10000', 'is_active' => true, 'is_booking_available' => true,
            'is_pos_available' => true]);
    }

    /** @return list<int> */
    private function products(): array
    {
        $ids = [];
        foreach (range(1, 4) as $i) {
            $ids[] = DB::table('products')->insertGetId(['name' => "Global {$i}", 'slug' => "global-{$i}",
                'sku' => "GLOBAL-{$i}", 'price' => 10, 'stock' => 99, 'low_stock_threshold' => 5,
                'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        return $ids;
    }

    /** @return array<string, int> */
    private function counts(): array
    {
        return collect(['products', 'store_location_product', 'store_location_product_inventories',
            'expense_categories', 'expenses'])->mapWithKeys(fn ($table) => [$table => DB::table($table)->count()])->all();
    }
}
