<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Commercial minimum bootstrap only. Demo catalogues, transactions and
     * multi-Branch QA fixtures must be invoked through their explicit tools.
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            BranchAccessPermissionSeeder::class,
            PosPaymentMethodPermissionSeeder::class,
            AdminSeeder::class,
            CustomerSuperAdminSeeder::class,
            SalesReportWithVoidPermissionSeeder::class,
            AppointmentActivityLogPermissionSeeder::class,
            SuperAdminBranchAccessPermissionSeeder::class,
            StaffPermissionSeeder::class,
            ProfitLossReportPermissionSeeder::class,
            EnsurePromotionPermissionsForSuperAdminSeeder::class,
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
            SuperAdminRoleSeeder::class,
            SuperAdminSeeder::class,
            StoreLocationsSeederReal::class,
            BranchAccessDefaultStoreLocationSeeder::class,

            GlobalSeoSeedeer::class,
            SettingSeeder::class,
            BranchLimitSettingSeeder::class,
            ShippingSettingSeeder::class,
            InvoiceProfileSeeder::class,
            LoyaltySettingSeeder::class,
            MembershipTiersSeeder::class,
            BookingSettingsSeeder::class,
            PaymentGatewaySeeder::class,
            BillplzPaymentGatewayOptionSeeder::class,

            PosPaymentMethodDefinitionSeeder::class,
            FreshInstallPosPaymentMethodSeeder::class,
            PosBranchOperationalSeeder::class,
        ]);
    }
}
