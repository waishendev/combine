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
            AdminSeeder::class,
            GlobalSeoSeedeer::class,
            SettingSeeder::class,
            ShippingSettingSeeder::class,
            InvoiceProfileSeeder::class,
            BankAccountSeeder::class,
            LoyaltySettingSeeder::class,
            // LoyaltyRewardSeederReal::class,
            // StoreLocationsSeederReal::class,
            // FooterWidgetSeederReal::class,

            SuperAdminRoleSeeder::class,
            SuperAdminSeeder::class,
           
            PaymentGatewaySeeder::class,
            FooterWidgetSeederTesting::class,
            FrontendTestDataSeeder::class,
            LoyaltyRewardSeederTesting::class,
            LoyaltyDemoCustomerSeederTesting::class,
            SelfPickupCompletedOrderSeeder::class,
            GuestCompletedOrderSeeder::class,
            // SalesReportSeeder::class,
            //ReturnRequestSeeder::class,

            // 暂时没用到的
            // PaymentGatewaySeeder::class, 
        ]);
    }
}
