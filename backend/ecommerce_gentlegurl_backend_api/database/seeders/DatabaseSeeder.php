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
            SalesReportWithVoidPermissionSeeder::class,
            AppointmentActivityLogPermissionSeeder::class,
            SuperAdminSeeder::class,
            BranchAccessPermissionSeeder::class,
            SuperAdminBranchAccessPermissionSeeder::class,
            StaffPermissionSeeder::class,



            GlobalSeoSeedeer::class,
            SettingSeeder::class,
            BranchLimitSettingSeeder::class,
            ShippingSettingSeeder::class,
            InvoiceProfileSeeder::class,
            BankAccountSeeder::class,
            LoyaltySettingSeeder::class,
            MembershipTiersSeeder::class,
            LoyaltyRewardSeederReal::class,
            StoreLocationsSeederReal::class,
            BranchAccessDefaultStoreLocationSeeder::class,
            FooterWidgetSeederReal::class,
            ServicesMenuAndPagesSeeder::class,
            CustomerTypeSeeder::class,
            ExpenseCategorySeeder::class,
            ProfitLossReportPermissionSeeder::class,
            ExpenseDemoSeeder::class,
            BookingSettingsSeeder::class,
            PaymentProofNotificationSettingSeeder::class,
            EnsurePromotionPermissionsForSuperAdminSeeder::class,
            LowStockNotificationTemplateSeeder::class, // if frontendTestDataSeeder no open . this is to send low storck message
            
            PaymentGatewaySeeder::class,
            BillplzPaymentGatewayOptionSeeder::class,
            BillplzPaymentGatewayPermissionSeeder::class,
            DashboardAnalyticsPermissionSeeder::class,
            CustomerWalletPermissionSeeder::class,
            StaffConsumablePermissionSeeder::class,
            StaffPosAppointmentsPermissionSeeder::class,
            StaffSalesReportPermissionSeeder::class,
            ActivityLogPermissionSeeder::class,
            ThermalPrinterPermissionSeeder::class,
            ExpensePermissionSeeder::class,
            AddBookingPermissionsSeeder::class,
            BookingLandingPageSeeder::class,
            BookingBranchAssignmentSeeder::class,
            ProductBranchAssignmentSeeder::class,
            PosBranchOperationalSeeder::class,
            // EcommerceLandingPageSeeder::class,
            // BookingProductSeeder::class,
            
            // // upper all should open , no command to avoid error seed
            // DemoMembersSeederTesting::class,

            // FrontendTestDataSeeder::class,
            // LoyaltyRewardSeederTesting::class,
            // LoyaltyDemoCustomerSeederTesting::class,
            // // SelfPickupCompletedOrderSeeder::class,
            // // GuestCompletedOrderSeeder::class,
          
            // BookingTestingSeeder::class,
            // BookingLeaveTestingSeeder::class,
            // ServicePackageTestingSeeder::class,
            // CommissionTestingSeeder::class,
            // ReturnDemoSeeder::class,
            // SalesReportSeeder::class,
            // ReturnRequestSeeder::class,

            // FooterWidgetSeederTesting::class, 没用了上面有了
            // 暂时没用到的
            // PaymentGatewaySeeder::class, 
        ]);
    }
}
