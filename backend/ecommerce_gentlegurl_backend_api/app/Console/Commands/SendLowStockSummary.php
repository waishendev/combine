<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Product;
use App\Services\Notifications\NotificationService;
use Illuminate\Console\Command;

class SendLowStockSummary extends Command
{
    protected $signature = 'ecommerce:send-low-stock-summary';

    protected $description = 'Send daily low stock summary to admins via email/whatsapp.';

    public function handle(NotificationService $notifications): int
    {
        $query = Product::query()
            ->where('track_stock', true)
            ->whereColumn('stock', '<', 'low_stock_threshold');

        $lowStockProducts = $query->get();

        if ($lowStockProducts->isEmpty()) {
            $this->info('No low stock products found.');
            return Command::SUCCESS;
        }

        $payload = $lowStockProducts->map(function (Product $p) {
            return [
                'sku' => $p->sku ?? '',
                'name' => $p->name ?? '',
                'stock' => (int) $p->stock,
                'threshold' => (int) $p->low_stock_threshold,
            ];
        })->all();

        $notifications->sendDailyLowStockSummary($payload);

        $this->info('Low stock summary sent for ' . count($payload) . ' products.');

        return Command::SUCCESS;
    }
}
