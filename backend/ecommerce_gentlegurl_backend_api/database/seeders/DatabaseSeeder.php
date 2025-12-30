<?php

namespace Database\Seeders;

use App\Models\CustomerAddress;
use App\Models\Ecommerce\Customer;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
            SuperAdminSeeder::class,
            AdminSeeder::class,
            SettingSeeder::class,
            ShippingSettingSeeder::class,
            // ShopContactWidgetSeeder::class,
            FrontendTestDataSeeder::class,
            BankAccountSeeder::class,
            LoyaltyRewardSeederReal::class,
            // LoyaltyDemoCustomerSeeder::class,
            // SalesReportSeeder::class,
            //ReturnRequestSeeder::class,
        ]);

        $customer = Customer::first();

        if ($customer && $customer->addresses()->count() === 0) {
            CustomerAddress::create([
                'customer_id' => $customer->id,
                'label' => 'Home',
                'type' => 'shipping',
                'name' => $customer->name,
                'phone' => '0123456789',
                'line1' => '123 Test Street',
                'line2' => 'Taman Contoh',
                'city' => 'George Town',
                'state' => 'Penang',
                'postcode' => '11000',
                'country' => 'Malaysia',
                'is_default' => true,
            ]);
        }
    }
}
