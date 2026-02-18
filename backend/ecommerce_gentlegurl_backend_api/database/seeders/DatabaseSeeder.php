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
            MembershipTiersSeeder::class,
            LoyaltyRewardSeederReal::class,
            StoreLocationsSeederReal::class,
            FooterWidgetSeederReal::class,
            ServicesMenuAndPagesSeeder::class,

            SuperAdminRoleSeeder::class,
            SuperAdminSeeder::class,
            PaymentGatewaySeeder::class,

            // upper all should open , no command to avoid error seed


            FooterWidgetSeederTesting::class,
            FrontendTestDataSeeder::class,
            LoyaltyRewardSeederTesting::class,
            LoyaltyDemoCustomerSeederTesting::class,
            SelfPickupCompletedOrderSeeder::class,
            GuestCompletedOrderSeeder::class,


            //ReturnDemoSeeder::class,
            // SalesReportSeeder::class,
            //ReturnRequestSeeder::class,

            // 暂时没用到的
            // PaymentGatewaySeeder::class, 
        ]);
    }
}
