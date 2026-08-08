<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Services\TransactionBranchBackfillService;
use Illuminate\Console\Command;

class BackfillTransactionBranchesCommand extends Command
{
    protected $signature = 'branch-transactions:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Safely attribute legacy bookings and evidence-backed orders to existing Branches.';

    public function handle(TransactionBranchBackfillService $service): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') {
            $this->error('The --store-code option is required.');
            return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            $this->error("No active StoreLocation exists with code [{$code}]. No writes were performed.");
            return self::FAILURE;
        }
        if (! $this->option('dry-run') && ! $this->option('force')) {
            $this->error('Refusing to write without --force. Review --dry-run first.');
            return self::FAILURE;
        }

        $summary = $this->option('dry-run') ? $service->preview($branch) : $service->run($branch);
        if ($this->option('dry-run')) $this->warn('DRY RUN: ZERO writes were performed.');
        $this->info("Selected default Branch: {$branch->name} ({$branch->code}) #{$branch->id}");
        foreach (['bookings', 'orders'] as $type) {
            $this->line(ucfirst($type).':');
            foreach ($summary[$type] as $label => $count) $this->line('  '.str_replace('_', ' ', $label).": {$count}");
        }
        $this->line("Invalid references: {$summary['invalid_references']}");
        if (! $this->option('dry-run')) {
            $this->line("Bookings changed: {$summary['bookings_changed']}");
            $this->line("Orders changed: {$summary['orders_changed']}");
        }
        return self::SUCCESS;
    }
}
