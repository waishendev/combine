<?php

namespace Database\Seeders;

use App\Models\Ecommerce\NotificationTemplate;
use Illuminate\Database\Seeder;

/**
 * Standalone seeder — safe to run on a live database.
 *
 * Required by ecommerce:send-low-stock-summary (NotificationService).
 *
 * php artisan db:seed --class=LowStockNotificationTemplateSeeder
 */
class LowStockNotificationTemplateSeeder extends Seeder
{
    public function run(): void
    {
        NotificationTemplate::updateOrCreate(
            ['key' => 'stock.low.admin.email'],
            [
                'channel' => 'email',
                'name' => 'Daily Low Stock Summary (Email)',
                'subject_template' => 'Daily Low Stock Summary - {{date}}',
                'body_template' => "Dear Admin,\n\n以下产品库存低于阈值（{{date}}）：\n\n{{product_list}}\n\n请尽快补货。",
                'variables' => ['{{date}}', '{{product_list}}'],
                'is_active' => true,
            ]
        );

        NotificationTemplate::updateOrCreate(
            ['key' => 'stock.low.admin.whatsapp'],
            [
                'channel' => 'whatsapp',
                'name' => 'Daily Low Stock Summary (WhatsApp)',
                'subject_template' => null,
                'body_template' => "[Low Stock Alert {{date}}]\n{{product_list}}",
                'variables' => ['{{date}}', '{{product_list}}'],
                'is_active' => true,
            ]
        );

        $this->command?->info('Low stock notification templates seeded (stock.low.admin.email / whatsapp).');
    }
}
