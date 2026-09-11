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
                'company_name' => 'Global Salon',
                'company_address' => 'Global Address',
                'footer_note' => 'Global footer',
                'currency' => 'MYR',
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

            $this->assertSame('Global Salon', $profile['company_name']);
            $this->assertSame('Global Address', $profile['company_address']);
        }
    }

    public function test_online_ecommerce_fulfilment_and_online_booking_branches_remain_global(): void
    {
        $ecommerce = new Order(['store_location_id' => 2]);
        $booking = new Order(['store_location_id' => 1, 'is_booking_checkout' => true]);

        $this->assertSame('Global Salon', $this->invoiceService->resolveInvoiceProfile($ecommerce)['company_name']);
        $this->assertSame('Global Salon', $this->invoiceService->resolveInvoiceProfile($booking)['company_name']);
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
}
