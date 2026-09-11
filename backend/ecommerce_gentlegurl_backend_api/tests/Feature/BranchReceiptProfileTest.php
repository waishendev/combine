<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Order;
use App\Models\Setting;
use App\Services\Ecommerce\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BranchReceiptProfileTest extends TestCase
{
    use RefreshDatabase;

    private InvoiceService $invoiceService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->invoiceService = app(InvoiceService::class);

        Setting::query()->updateOrCreate(
            ['type' => 'ecommerce', 'key' => 'ecommerce.invoice_profile'],
            ['value' => [
                'company_name' => 'Ecommerce Salon',
                'company_address' => 'Ecommerce Address',
                'footer_note' => 'Ecommerce footer',
                'currency' => 'MYR',
                'booking_invoice_profile' => [
                    'company_name' => 'Booking Salon',
                    'company_address' => 'Booking Address',
                    'footer_note' => 'Booking footer',
                ],
                'default_pos_receipt_profile' => [
                    'company_name' => 'Default POS Salon',
                    'company_address' => 'Default POS Address',
                    'footer_note' => 'Default POS footer',
                ],
                'branch_receipt_overrides' => [
                    '1' => [
                        'company_name' => 'Salon Branch 1',
                        'company_address' => 'Branch 1 Address',
                        'footer_note' => 'Branch 1 footer',
                    ],
                    '2' => [
                        'company_name' => 'Salon Branch 2',
                        'company_address' => 'Branch 2 Address',
                        'footer_note' => 'Branch 2 footer',
                    ],
                ],
            ]],
        );
    }

    public function test_pos_and_appointment_receipts_use_the_persisted_order_branch(): void
    {
        foreach ([1, 2] as $branchId) {
            $order = new Order([
                'store_location_id' => $branchId,
                'created_by_user_id' => 99,
                'pickup_or_shipping' => 'in_store',
            ]);

            $profile = $this->invoiceService->resolveInvoiceProfile($order);

            $this->assertSame("Salon Branch {$branchId}", $profile['company_name']);
            $this->assertSame("Branch {$branchId} Address", $profile['company_address']);
            $this->assertSame("Branch {$branchId} footer", $profile['footer_note']);
        }
    }

    public function test_missing_or_null_branch_override_uses_global_without_inferring_a_branch(): void
    {
        foreach ([null, 999] as $branchId) {
            $profile = $this->invoiceService->resolveInvoiceProfile(new Order([
                'store_location_id' => $branchId,
                'created_by_user_id' => 99,
                'pickup_or_shipping' => 'in_store',
            ]));

            $this->assertSame('Default POS Salon', $profile['company_name']);
            $this->assertSame('Default POS Address', $profile['company_address']);
        }
    }

    public function test_online_ecommerce_fulfilment_and_online_booking_branches_remain_global(): void
    {
        $ecommerce = new Order(['store_location_id' => 2]);
        $booking = new Order(['store_location_id' => 1, 'is_booking_checkout' => true]);

        $this->assertSame('Ecommerce Salon', $this->invoiceService->resolveInvoiceProfile($ecommerce)['company_name']);
        $this->assertSame('Booking Salon', $this->invoiceService->resolveInvoiceProfile($booking)['company_name']);
    }

    public function test_receipt_resolution_does_not_query_branch_metadata(): void
    {
        $branchQueries = 0;
        DB::listen(function ($query) use (&$branchQueries): void {
            if (str_contains(strtolower($query->sql), 'store_locations')) {
                $branchQueries++;
            }
        });

        $this->invoiceService->resolveInvoiceProfile(new Order([
            'store_location_id' => 2,
            'created_by_user_id' => 99,
            'pickup_or_shipping' => 'in_store',
        ]));

        $this->assertSame(0, $branchQueries);
    }

    public function test_legacy_global_profile_falls_back_for_booking_and_pos_without_migration(): void
    {
        Setting::query()->where('type', 'ecommerce')->where('key', 'ecommerce.invoice_profile')->update([
            'value' => [
                'company_name' => 'Legacy Salon',
                'company_address' => 'Legacy Address',
                'footer_note' => 'Legacy footer',
                'currency' => 'MYR',
            ],
        ]);

        $booking = new Order(['store_location_id' => 1, 'is_booking_checkout' => true]);
        $pos = new Order(['store_location_id' => 1, 'pickup_or_shipping' => 'in_store']);

        $this->assertSame('Legacy Salon', $this->invoiceService->resolveInvoiceProfile($booking)['company_name']);
        $this->assertSame('Legacy Salon', $this->invoiceService->resolveInvoiceProfile($pos)['company_name']);
    }

    public function test_branch_profile_ui_uses_explicit_status_list_instead_of_branch_dropdown(): void
    {
        $source = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/ShopSettingsPageContent.tsx'));

        $this->assertStringContainsString('Branch POS Receipt Profiles', $source);
        $this->assertStringContainsString("isCustom ? 'Custom' : 'Using Default'", $source);
        $this->assertStringContainsString('Edit Receipt Profile — {editingReceiptBranch.name}', $source);
        $this->assertStringNotContainsString('<span className="block text-sm font-medium text-slate-800">Branch</span>', $source);
    }
}
