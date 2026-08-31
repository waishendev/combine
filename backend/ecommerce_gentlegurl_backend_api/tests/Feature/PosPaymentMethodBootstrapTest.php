<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\PosPaymentMethod;
use App\Services\PosPaymentMethodService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PosPaymentMethodBootstrapTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_commercial_default_without_qa_transactions(): void
    {
        $this->seed(DatabaseSeeder::class);
        $branch = StoreLocation::query()->where('code', config('multi_branch.fresh_install_store_code'))->firstOrFail();

        $this->assertSame(4, PosPaymentMethod::query()->count());
        $this->assertSame(4, DB::table('store_location_pos_payment_methods')->where('store_location_id', $branch->id)->count());
        $this->assertFalse(DB::getSchemaBuilder()->hasTable('store_location_pos_payment_settings'));
        $this->assertSame(2, DB::table('permissions')->whereIn('slug', ['pos.payment-method-settings.view', 'pos.payment-method-settings.update'])->count());
        $configuration = app(PosPaymentMethodService::class)->configuration((int) $branch->id);
        $this->assertTrue($configuration['is_configured']);
        $this->assertSame(['cash', 'qrpay', 'credit_card', 'customer_balance'], collect($configuration['methods'])->where('is_enabled', true)->pluck('key')->all());
        $this->assertArrayNotHasKey('allow_split_payment', $configuration);
        $this->assertArrayNotHasKey('auto_calculate_split', $configuration);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('expenses', 0);
    }

    public function test_normal_reseed_preserves_customized_default_branch_configuration(): void
    {
        $this->seed(DatabaseSeeder::class);
        $branch = StoreLocation::query()->where('code', config('multi_branch.fresh_install_store_code'))->firstOrFail();
        $cardId = PosPaymentMethod::query()->where('key', 'credit_card')->value('id');
        DB::table('store_location_pos_payment_methods')->where(['store_location_id' => $branch->id, 'pos_payment_method_id' => $cardId])->update(['is_enabled' => false]);

        $this->seed(DatabaseSeeder::class);

        $this->assertFalse((bool) DB::table('store_location_pos_payment_methods')->where(['store_location_id' => $branch->id, 'pos_payment_method_id' => $cardId])->value('is_enabled'));
        $this->assertSame(4, DB::table('store_location_pos_payment_methods')->where('store_location_id', $branch->id)->count());
    }

    public function test_frontend_contract_keeps_split_state_transaction_local(): void
    {
        $root = dirname(base_path(), 2);
        $checkout = file_get_contents($root.'/frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');
        $appointments = file_get_contents($root.'/frontend/ecommerce_gentlegurl_crm/src/components/pos/PosAppointmentsWorkspace.tsx');
        $settings = file_get_contents($root.'/frontend/ecommerce_gentlegurl_crm/src/components/pos/PosPaymentMethodSettings.tsx');
        $hook = file_get_contents($root.'/frontend/ecommerce_gentlegurl_crm/src/hooks/usePosPaymentConfiguration.ts');

        $this->assertStringContainsString('useState(true)', $checkout);
        $this->assertStringContainsString('Auto Calculate Split', $checkout);
        $this->assertStringContainsString('appointmentDetail?.store_location_id', $appointments);
        $this->assertStringContainsString('appointmentAutoCalculateSplit, setAppointmentAutoCalculateSplit] = useState(true)', $appointments);
        $this->assertStringContainsString('checked={appointmentAutoCalculateSplit}', $appointments);
        $this->assertStringContainsString('appointmentAutoCalculateSplit\n                              ? applyAutoSplitEdit', $appointments);
        $this->assertStringNotContainsString('allow_split_payment', $settings.$hook);
        $this->assertStringNotContainsString('auto_calculate_split', $settings.$hook);
    }
}
