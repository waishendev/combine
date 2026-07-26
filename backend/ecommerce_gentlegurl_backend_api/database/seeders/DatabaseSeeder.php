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
            CustomerSuperAdminSeeder::class,
            SuperAdminRoleSeeder::class,
            SuperAdminSeeder::class,
            StaffPermissionSeeder::class,
            SalesReportWithVoidPermissionSeeder::class,
            // AppointmentActivityLogPermissionSeeder::class,

            GlobalSeoSeedeer::class,
            SettingSeeder::class,
            WalletTopupReserveMinutesSettingSeeder::class,
            ShippingSettingSeeder::class,
            InvoiceProfileSeeder::class,
            BankAccountSeeder::class,
            LoyaltySettingSeeder::class,
            MembershipTiersSeeder::class,
            LoyaltyRewardSeederReal::class,
            StoreLocationsSeederReal::class,
            FooterWidgetSeederReal::class,
            ServicesMenuAndPagesSeeder::class,
            CustomerTypeSeeder::class,
            BookingSettingsSeeder::class,
            PaymentProofNotificationSettingSeeder::class,
            EnsurePromotionPermissionsForSuperAdminSeeder::class,
            StaffSalesReportPermissionSeeder::class,
            ExpenseCategorySeeder::class,
            ExpenseDemoSeeder::class,
            
            PaymentGatewaySeeder::class,
            BillplzPaymentGatewayOptionSeeder::class,
            BookingLandingPageSeeder::class,
            EcommerceLandingPageSeeder::class,
            BookingProductSeeder::class,
            
            // upper all should open , no command to avoid error seed
            DemoMembersSeederTesting::class,

            FrontendTestDataSeeder::class,
            LoyaltyRewardSeederTesting::class,
            LoyaltyDemoCustomerSeederTesting::class,
            // SelfPickupCompletedOrderSeeder::class,
            // GuestCompletedOrderSeeder::class,
            
            BookingTestingSeeder::class,
            BookingLeaveTestingSeeder::class,
            ServicePackageTestingSeeder::class,
            CustomerWalletPermissionSeeder::class,
            ProfitLossReportPermissionSeeder::class,
            // CommissionTestingSeeder::class,

            // DepositSettlementTestingSeeder::class,
            // RetursnDemoSeeder::class,
            // SalesReportSeeder::class,
            // ReturnRequestSeeder::class,

            // FooterWidgetSeederTesting::class, 没用了上面有了
            // 暂时没用到的
            // PaymentGatewaySeeder::class, 
        ]);
    }
}
