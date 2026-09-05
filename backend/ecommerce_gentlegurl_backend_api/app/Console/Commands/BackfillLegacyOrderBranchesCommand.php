<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Services\LegacyOrderBranchBackfillService;
use Illuminate\Console\Command;

class BackfillLegacyOrderBranchesCommand extends Command
{
    protected $signature = 'order-branch:legacy-backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Explicitly assign remaining NULL Orders from a known single-store legacy deployment.';

    public function handle(LegacyOrderBranchBackfillService $service): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') {
            $this->error('The --store-code option is required. No writes were performed.');
            return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            $this->error("No active StoreLocation exists with code [{$code}]. No writes were performed.");
            return self::FAILURE;
        }
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::FAILURE;
        }

        $summary = $this->option('dry-run') ? $service->preview($branch) : $service->run($branch);
        $this->info("Target Branch: #{$branch->id} {$branch->code} — {$branch->name}");
        foreach (['total_null', 'rows_would_be_updated', 'already_attributed', 'earliest_null', 'latest_null', 'product_profit_order_count'] as $key) {
            $this->line(str_replace('_', ' ', ucfirst($key)).': '.($summary[$key] ?? 'none'));
        }
        $this->line('NULL Order breakdown:');
        foreach ($summary['breakdown'] as $type => $count) $this->line("  {$type}: {$count}");
        $this->line('NULL Orders by date:');
        foreach ($summary['null_by_date'] as $date => $count) $this->line("  {$date}: {$count}");
        $this->line('NULL Order samples: '.(implode(', ', $summary['sample_order_ids']) ?: 'none'));
        $this->line('Product Profit samples: '.(implode(', ', $summary['sample_product_profit_order_ids']) ?: 'none'));
        if ($this->option('dry-run')) $this->warn('DRY RUN: ZERO writes were performed. This command is only for the pre-Multi-Branch single-store rollout; future NULL Orders must be investigated, not backfilled.');
        else $this->info("Orders changed: {$summary['orders_changed']}");

        return self::SUCCESS;
    }
}
