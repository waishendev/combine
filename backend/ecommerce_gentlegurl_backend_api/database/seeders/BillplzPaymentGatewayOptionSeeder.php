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
        // NOTE: These are placeholder/demo channel codes for local/UAT testing.
        // Replace with the confirmed Billplz production payment channel codes before go-live.
        $banks = [
            // HOTFIX scope: enable Maybank direct routing first.
            ['code' => 'MB2U0227', 'name' => 'Maybank2u', 'is_default' => true, 'is_active' => true, 'sort_order' => 1],
            ['code' => 'demo_cimb_clicks', 'name' => 'CIMB Clicks', 'is_default' => false, 'is_active' => false, 'sort_order' => 2],
            ['code' => 'demo_public_bank', 'name' => 'Public Bank', 'is_default' => false, 'is_active' => false, 'sort_order' => 3],
            ['code' => 'demo_rhb_now', 'name' => 'RHB Now', 'is_default' => false, 'is_active' => false, 'sort_order' => 4],
            ['code' => 'demo_hong_leong_connect', 'name' => 'Hong Leong Connect', 'is_default' => false, 'is_active' => false, 'sort_order' => 5],
        ];

        foreach ($banks as $bank) {
            BillplzPaymentGatewayOption::query()->updateOrCreate(
                [
                    'type' => $type,
                    'gateway_group' => 'online_banking',
                    'code' => $bank['code'],
                ],
                [
                    'name' => $bank['name'],
                    'is_active' => (bool) $bank['is_active'],
                    'is_default' => (bool) $bank['is_default'],
                    'sort_order' => (int) $bank['sort_order'],
                    'description' => 'Demo seed data. Replace with real Billplz bank code in production.',
                    'meta' => [
                        'seeded_demo' => true,
                        'note' => 'Replace demo code with real Billplz payment channel code before production use.',
                    ],
                ]
            );
        }

        BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', 'online_banking')
            ->where('code', '!=', 'MB2U0227')
            ->update([
                'is_default' => false,
                'is_active' => false,
            ]);
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
