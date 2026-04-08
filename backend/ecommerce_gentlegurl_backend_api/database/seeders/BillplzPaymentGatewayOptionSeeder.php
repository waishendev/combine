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
            ['code' => 'demo_maybank2u', 'name' => 'Maybank2U', 'is_default' => true, 'sort_order' => 1],
            ['code' => 'demo_cimb_clicks', 'name' => 'CIMB Clicks', 'is_default' => false, 'sort_order' => 2],
            ['code' => 'demo_public_bank', 'name' => 'Public Bank', 'is_default' => false, 'sort_order' => 3],
            ['code' => 'demo_rhb_now', 'name' => 'RHB Now', 'is_default' => false, 'sort_order' => 4],
            ['code' => 'demo_hong_leong_connect', 'name' => 'Hong Leong Connect', 'is_default' => false, 'sort_order' => 5],
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
                    'is_active' => true,
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
            ->where('code', '!=', 'demo_maybank2u')
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    private function seedCreditCard(string $type): void
    {
        BillplzPaymentGatewayOption::query()->updateOrCreate(
            [
                'type' => $type,
                'gateway_group' => 'credit_card',
                'code' => 'billplz_card_default',
            ],
            [
                'name' => 'Credit Card',
                'is_active' => true,
                'is_default' => true,
                'sort_order' => 1,
                'description' => 'Demo seed data. Replace with real Billplz credit card channel code in production.',
                'meta' => [
                    'seeded_demo' => true,
                    'note' => 'Replace demo code with real Billplz card channel code before production use.',
                ],
            ]
        );
    }
}
