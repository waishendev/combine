<?php

namespace Database\Seeders;

use App\Models\BillplzPaymentGatewayOption;
use Illuminate\Database\Seeder;

class BillplzPaymentGatewayOptionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['ecommerce', 'booking'] as $type) {
            $this->seedOnlineBanking($type);
            $this->seedCreditCard($type);
        }
    }

    private function seedOnlineBanking(string $type): void
    {
        // Billplz FPX / online banking channel codes — confirm against your Billplz collection settings.
        $banks = [
            ['code' => 'MB2U0227', 'name' => 'Maybank2u', 'is_default' => true, 'is_active' => true, 'sort_order' => 1],
            ['code' => 'UOB0226', 'name' => 'UOB Internet Banking', 'is_default' => false, 'is_active' => true, 'sort_order' => 2],
            ['code' => 'HLB0224', 'name' => 'HLB Connect', 'is_default' => false, 'is_active' => true, 'sort_order' => 3],
            ['code' => 'HSBC0223', 'name' => 'HSBC Online Banking', 'is_default' => false, 'is_active' => true, 'sort_order' => 4],
            ['code' => 'BSN0601', 'name' => 'myBSN', 'is_default' => false, 'is_active' => true, 'sort_order' => 5],
            ['code' => 'ABB0234', 'name' => 'Affin Bank', 'is_default' => false, 'is_active' => true, 'sort_order' => 6],
            ['code' => 'AMBB0209', 'name' => 'AmOnline', 'is_default' => false, 'is_active' => true, 'sort_order' => 7],
            ['code' => 'BCBB0235', 'name' => 'CIMB Clicks', 'is_default' => false, 'is_active' => true, 'sort_order' => 8],
            ['code' => 'BIMB0340', 'name' => 'Bank Islam Internet Banking', 'is_default' => false, 'is_active' => true, 'sort_order' => 9],
        ];

        foreach ($banks as $bank) {
            $code = (string) $bank['code'];
            BillplzPaymentGatewayOption::query()->updateOrCreate(
                [
                    'type' => $type,
                    'gateway_group' => 'online_banking',
                    'code' => $code,
                ],
                [
                    'name' => $bank['name'],
                    'logo_url' => '/images/banks/'.$code.'.svg',
                    'is_active' => (bool) $bank['is_active'],
                    'is_default' => (bool) $bank['is_default'],
                    'sort_order' => (int) $bank['sort_order'],
                    'description' => 'Billplz FPX online banking channel code.',
                    'meta' => [
                        'seeded_demo' => false,
                        'note' => 'Confirm channel codes match your Billplz collection / gateway configuration.',
                    ],
                ]
            );
        }

        BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', 'online_banking')
            ->where('code', 'like', 'demo_%')
            ->delete();
    }

    private function seedCreditCard(string $type): void
    {
        BillplzPaymentGatewayOption::query()->updateOrCreate(
            [
                'type' => $type,
                'gateway_group' => 'credit_card',
                // Billplz published card gateway code (must be validated against active account gateways).
                'code' => 'BP-BILLPLZ1',
            ],
            [
                'name' => 'Credit Card',
                'is_active' => true,
                'is_default' => true,
                'sort_order' => 1,
                'description' => 'Billplz card gateway code. Confirm active status in your Billplz account.',
                'meta' => [
                    'seeded_demo' => false,
                    'note' => 'Use active Billplz card gateway code for this account/workspace.',
                ],
            ]
        );

        BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', 'credit_card')
            ->where('code', '!=', 'BP-BILLPLZ1')
            ->update([
                'is_default' => false,
                'is_active' => false,
            ]);
    }
}
