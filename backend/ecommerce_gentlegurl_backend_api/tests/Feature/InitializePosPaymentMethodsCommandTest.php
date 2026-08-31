<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\PosPaymentMethod;
use Database\Seeders\PosPaymentMethodDefinitionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InitializePosPaymentMethodsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_has_zero_writes_and_force_materializes_exact_branch(): void
    {
        $this->seed(PosPaymentMethodDefinitionSeeder::class);
        $branch = $this->branch('CMD');
        $this->artisan('pos-payment-methods:initialize', ['--store-code' => 'CMD', '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseCount('store_location_pos_payment_methods', 0);
        $this->artisan('pos-payment-methods:initialize', ['--store-code' => 'CMD', '--force' => true])->assertSuccessful();
        $this->assertSame(4, DB::table('store_location_pos_payment_methods')->where('store_location_id', $branch->id)->count());
        $this->assertFalse(DB::getSchemaBuilder()->hasTable('store_location_pos_payment_settings'));
    }

    public function test_rerun_without_force_is_idempotent_and_preserves_customization(): void
    {
        $this->seed(PosPaymentMethodDefinitionSeeder::class);
        $branch = $this->branch('SAFE');
        $this->artisan('pos-payment-methods:initialize', ['--store-code' => 'SAFE'])->assertSuccessful();
        $cashId = PosPaymentMethod::query()->where('key', 'cash')->value('id');
        DB::table('store_location_pos_payment_methods')->where(['store_location_id' => $branch->id, 'pos_payment_method_id' => $cashId])->update(['is_enabled' => false]);
        $this->artisan('pos-payment-methods:initialize', ['--store-code' => 'SAFE'])->assertSuccessful();
        $this->assertFalse((bool) DB::table('store_location_pos_payment_methods')->where(['store_location_id' => $branch->id, 'pos_payment_method_id' => $cashId])->value('is_enabled'));
        $this->assertSame(4, DB::table('store_location_pos_payment_methods')->where('store_location_id', $branch->id)->count());
    }

    public function test_store_code_is_required_and_unknown_code_fails(): void
    {
        $this->artisan('pos-payment-methods:initialize')->assertExitCode(2);
        $this->artisan('pos-payment-methods:initialize', ['--store-code' => 'MISSING'])->assertFailed();
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::query()->create(['name' => "Branch {$code}", 'code' => $code, 'is_active' => true, 'is_pos_available' => true, 'sort_order' => 1]);
    }
}
