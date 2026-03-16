<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use Illuminate\Database\Seeder;

class BankAccountSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['ecommerce', 'booking'] as $type) {
            $suffix = $type === 'booking' ? ' (Booking)' : '';

            BankAccount::updateOrCreate(
                ['type' => $type, 'label' => 'Maybank Account 1' . $suffix],
                [
                    'bank_name' => 'Maybank',
                    'account_name' => 'GENTLEGURL SDN BHD',
                    'account_number' => $type === 'booking' ? '2234567890' : '1234567890',
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
                ['type' => $type, 'label' => 'Public Bank Account 1' . $suffix],
                [
                    'bank_name' => 'Public Bank',
                    'account_name' => 'GENTLEGURL SDN BHD',
                    'account_number' => $type === 'booking' ? '8876543210' : '9876543210',
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
}
