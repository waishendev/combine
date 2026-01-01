<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class InvoiceProfileSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'ecommerce.invoice_profile'],
            [
                'value' => [
                    'company_logo_url' => null,
                    'company_name' => 'Gentlegurl Shop',
                    'company_address' => "123 Gentle Lane\nKuala Lumpur\nMalaysia",
                    'company_phone' => null,
                    'company_email' => null,
                    'footer_note' => 'This is a computer-generated invoice.',
                    'currency' => 'MYR',
                ],
            ]
        );
    }
}
