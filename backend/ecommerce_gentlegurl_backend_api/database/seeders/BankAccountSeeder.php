<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use Illuminate\Database\Seeder;

class BankAccountSeeder extends Seeder
{
    public function run(): void
    {
        BankAccount::updateOrCreate(
            ['label' => 'Maybank Account 1'],
            [
                'bank_name' => 'Maybank',
                'account_name' => 'GENTLEGURL SDN BHD',
                'account_number' => '1234567890',
                'branch' => 'Gurney Plaza Branch',
                'swift_code' => 'MBBEMYKL',
                'logo_path' => 'https://example.com/banks/maybank.png',
                'qr_image_path' => 'https://example.com/banks/qr_maybank.png',
                'is_active' => true,
                'is_default' => true,
                'sort_order' => 1,
                'instructions' => 'After transfer, please upload your payment slip within 24 hours.',
            ]
        );

        BankAccount::updateOrCreate(
            ['label' => 'Public Bank Account 1'],
            [
                'bank_name' => 'Public Bank',
                'account_name' => 'GENTLEGURL SDN BHD',
                'account_number' => '9876543210',
                'branch' => null,
                'swift_code' => null,
                'logo_path' => 'https://example.com/banks/publicbank.png',
                'qr_image_path' => null,
                'is_active' => true,
                'is_default' => false,
                'sort_order' => 2,
                'instructions' => null,
            ]
        );
    }
}
