<?php

namespace Database\Seeders;

use App\Models\BillplzPaymentGatewayOption;
use Illuminate\Database\Seeder;

/**
 * LIVE-safe patch: only adds Public Bank + RHB online banking options.
 *
 * php artisan db:seed --class=BillplzPublicBankRhbOptionSeeder
 */
class BillplzPublicBankRhbOptionSeeder extends Seeder
{
    public function run(): void
    {
        $banks = [
            ['code' => 'PBBEMYKL', 'name' => 'Public Bank Berhad', 'is_default' => false, 'is_active' => true, 'sort_order' => 10],
            ['code' => 'RHBBMYKL', 'name' => 'RHB Bank Berhad', 'is_default' => false, 'is_active' => true, 'sort_order' => 11],
        ];

        foreach (['ecommerce', 'booking'] as $type) {
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
        }

        $this->command?->info('Public Bank (PBBEMYKL) + RHB (RHBBMYKL) Billplz options synced for ecommerce + booking.');
    }
}
