<?php

namespace Tests\Unit;

use App\Models\Ecommerce\BranchNotificationSetting;
use App\Models\Ecommerce\StoreLocation;
use App\Support\BranchEmailPresentation;
use PHPUnit\Framework\TestCase;

class MultiBranchEmailArchitectureTest extends TestCase
{
    public function test_venue_snapshot_comes_only_from_persisted_store_location(): void
    {
        $branch = new StoreLocation(['name' => 'Branch 2', 'address_line1' => '2 Main St', 'postcode' => '50000', 'city' => 'KL', 'phone' => '0123']);
        $this->assertSame(['name' => 'Branch 2', 'address' => "2 Main St\n50000 KL", 'phone' => '0123'], BranchEmailPresentation::from($branch));
        $this->assertNull(BranchEmailPresentation::from(null));
    }

    public function test_initial_recipients_are_persisted_defaults_not_runtime_fallbacks(): void
    {
        $defaults = BranchNotificationSetting::initialValues();
        $this->assertSame(['gentlegurls@gmail.com'], $defaults['booking_payment_proof_recipients']);
        $this->assertSame(['gentlegurls@gmail.com'], $defaults['daily_order_summary_recipients']);
        $this->assertSame(['gentlegurls@gmail.com'], $defaults['daily_low_stock_recipients']);
    }

    public function test_mail_flows_do_not_consult_header_auth_staff_or_png_for_branch(): void
    {
        $files = [
            app_path('Console/Commands/SendBookingReminderEmails.php'), app_path('Console/Commands/SendBookingFeedbackEmails.php'),
            app_path('Jobs/SendDailyOrderSummaryEmailJob.php'), app_path('Http/Controllers/Booking/PaymentController.php'),
        ];
        foreach ($files as $file) {
            $source = file_get_contents($file);
            $this->assertStringNotContainsString('branch_store_location_id', $source);
            $this->assertStringNotContainsString("where('code', 'PNG')", $source);
            $this->assertStringNotContainsString('staff->store_location_id', $source);
        }
    }
    public function test_branch_schedulers_and_internal_routing_are_isolated(): void
    {
        $reminder = file_get_contents(app_path('Console/Commands/SendBookingReminderEmails.php'));
        $feedback = file_get_contents(app_path('Console/Commands/SendBookingFeedbackEmails.php'));
        $stock = file_get_contents(app_path('Console/Commands/SendLowStockSummary.php'));
        $summary = file_get_contents(app_path('Jobs/SendDailyOrderSummaryEmailJob.php'));
        $proof = file_get_contents(app_path('Http/Controllers/Booking/PaymentController.php'));
        $this->assertStringContainsString("booking_reminder_sent_'.\$setting->store_location_id", $reminder);
        $this->assertStringContainsString("where('store_location_id', \$setting->store_location_id)", $reminder);
        $this->assertStringContainsString("booking_feedback_sent_'.\$setting->store_location_id", $feedback);
        $this->assertStringContainsString("where('store_location_id', \$setting->store_location_id)", $feedback);
        $this->assertStringContainsString("groupBy('store_location_id')", $stock);
        $this->assertStringContainsString('daily_low_stock_recipients', $stock);
        $this->assertStringContainsString("where('fulfillment_store_location_id', \$branchId)", $summary);
        $this->assertStringContainsString('Branch fulfilment subtotal', $summary);
        $this->assertStringContainsString('booking_payment_proof_recipients', $proof);
        $this->assertStringContainsString('legacy Booking has no Branch', $proof);
    }

    public function test_global_ecommerce_and_pos_safety_contracts(): void
    {
        $shipping = file_get_contents(app_path('Http/Controllers/Ecommerce/OrderController.php'));
        $ecommerceProof = file_get_contents(app_path('Http/Controllers/Ecommerce/PublicCheckoutController.php'));
        $pos = file_get_contents(app_path('Http/Controllers/Ecommerce/PosController.php'));
        $this->assertStringContainsString("SettingService::get('ecommerce.invoice_profile'", $shipping);
        $this->assertStringContainsString("&& ! \$wasShipped", $shipping);
        $this->assertStringContainsString("SettingService::get('ecommerce_payment_proof_notification'", $ecommerceProof);
        $this->assertStringContainsString('notifyBookingCheckoutPaymentProofUploaded', $ecommerceProof);
        $this->assertStringContainsString('booking_payment_proof_recipients', $ecommerceProof);
        $this->assertStringContainsString("is_booking_checkout", $ecommerceProof);
        $this->assertStringContainsString('authorizeReceiptOrderBranch($request, $order)', $pos);
        $this->assertStringContainsString("\$ids->count() === 1", $pos);
        $this->assertStringContainsString('resolveInvoiceProfile($order)', $pos);
    }

    public function test_initializer_is_non_overwriting_and_future_branches_are_initialized(): void
    {
        $command = file_get_contents(app_path('Console/Commands/InitializeBranchEmailSettings.php'));
        $store = file_get_contents(app_path('Models/Ecommerce/StoreLocation.php'));
        $this->assertStringContainsString("if (! \$existing && \$this->option('force'))", $command);
        $this->assertStringContainsString('BranchNotificationSetting::query()->firstOrCreate', $store);
        $this->assertStringNotContainsString("env('NOTIFY_ADMIN_EMAILS'", file_get_contents(app_path('Jobs/SendDailyOrderSummaryEmailJob.php')));
    }

}
