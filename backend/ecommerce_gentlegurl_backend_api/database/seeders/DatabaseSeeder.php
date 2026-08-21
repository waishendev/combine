<?php

namespace Database\Seeders;

use App\Models\CustomerAddress;
use App\Models\Ecommerce\Customer;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $profile = config('multi_branch.fresh_seed_profile');
        if (! in_array($profile, ['branch_one', 'both'], true)) {
            throw new RuntimeException('MULTI_BRANCH_SEED_PROFILE must be branch_one or both.');
        }

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

            // Branch masters must exist before access, Expense, Booking, Product,
            // POS and QA attribution seeders. Branch admins are deliberately
            // isolated to their own store_location_user assignment.
            StoreLocationsSeederReal::class,
            FreshInstallBranchOneSeeder::class,
            ...($profile === 'branch_one'
                ? []
                : [FreshInstallBranchTwoSeeder::class]),
            FreshInstallSharedBranchAdminSeeder::class,

            GlobalSeoSeedeer::class,
            SettingSeeder::class,
            BranchLimitSettingSeeder::class,
            ShippingSettingSeeder::class,
            InvoiceProfileSeeder::class,
            BankAccountSeeder::class,
            LoyaltySettingSeeder::class,
            MembershipTiersSeeder::class,
            LoyaltyRewardSeederReal::class,
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
            FreshInstallGlobalQaCatalogSeeder::class,
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

        // Run after all global catalogue/Staff/Service seeders so both Branches
        // reuse those identities rather than cloning them.
        $this->call(FreshInstallMultiBranchQaDataSeeder::class);
    }
}
