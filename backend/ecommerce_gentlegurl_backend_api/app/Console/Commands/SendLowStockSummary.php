<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Services\Notifications\NotificationService;
use Illuminate\Console\Command;

class SendLowStockSummary extends Command
{
    protected $signature = 'ecommerce:send-low-stock-summary';

    protected $description = 'Send daily low stock summary to admins via email/whatsapp.';

    public function handle(NotificationService $notifications): int
    {
        $payload = [];

        $lowStockProducts = Product::query()
            ->where('track_stock', true)
            ->where('low_stock_threshold', '>', 0)
            ->whereColumn('stock', '<', 'low_stock_threshold')
            ->whereDoesntHave('variants', fn ($q) => $q->where('is_active', true))
            ->get();

        foreach ($lowStockProducts as $p) {
            $payload[] = [
                'sku' => $p->sku ?? '',
                'name' => $p->name ?? '',
                'cn_name' => $p->cn_name ?? '',
                'variant_name' => null,
                'variant_cn_name' => null,
                'stock' => (int) $p->stock,
                'threshold' => (int) $p->low_stock_threshold,
            ];
        }

        $lowStockVariants = ProductVariant::query()
            ->with('product:id,name,cn_name,sku')
            ->where('track_stock', true)
            ->where('is_active', true)
            ->where('is_bundle', false)
            ->where('low_stock_threshold', '>', 0)
            ->whereColumn('stock', '<', 'low_stock_threshold')
            ->get();

        foreach ($lowStockVariants as $v) {
            $payload[] = [
                'sku' => $v->sku ?? $v->product?->sku ?? '',
                'name' => $v->product?->name ?? '',
                'cn_name' => $v->product?->cn_name ?? '',
                'variant_name' => $v->title ?? '',
                'variant_cn_name' => $v->cn_name ?? '',
                'stock' => (int) $v->stock,
                'threshold' => (int) $v->low_stock_threshold,
            ];
        }

        if (empty($payload)) {
            $this->info('No low stock products found.');
            return Command::SUCCESS;
        }

        $notifications->sendDailyLowStockSummary($payload);

        $this->info('Low stock summary sent for ' . count($payload) . ' items.');

        return Command::SUCCESS;
    }
}
