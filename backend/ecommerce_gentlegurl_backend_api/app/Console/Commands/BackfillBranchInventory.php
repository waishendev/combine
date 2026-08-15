<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Services\Ecommerce\BranchInventoryReconciliationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillBranchInventory extends Command
{
    protected $signature = 'branch-inventory:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Reconcile legacy global balances into one explicitly selected Branch without activating cutover';

    public function handle(BranchInventoryReconciliationService $reconciliation): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '' || $this->option('dry-run') === $this->option('force')) {
            $this->error('Provide --store-code and exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            $this->error("Active Branch code [{$code}] was not found; no Branch was created.");
            return self::FAILURE;
        }
        $report = $reconciliation->analyse($branch);
        foreach (['product_rows', 'variant_rows', 'legacy_total_quantity', 'existing_branch_total_quantity', 'missing_count', 'matching_count', 'mismatch_count', 'extra_count', 'bundle_variants', 'bundle_component_links'] as $key) {
            $this->line("{$key}: {$report[$key]}");
        }
        if ($this->option('dry-run')) {
            $this->info('Dry run: zero writes. Cutover remains inactive.');
            return self::SUCCESS;
        }
        if (StoreLocation::query()->where('is_active', true)->count() > 1) {
            $this->error('Force refused: global stock cannot be assigned to one Branch when multiple active physical Branches exist. Import reviewed per-Branch counts instead.');
            return self::FAILURE;
        }
        if ($report['mismatch_count'] > 0 || $report['extra_count'] > 0) {
            $this->error('Force refused: existing Branch inventory has mismatched or unresolved extra rows. Reconcile explicitly; nothing was overwritten.');
            return self::FAILURE;
        }

        DB::transaction(function () use ($branch, $reconciliation) {
            $now = now();
            foreach ($reconciliation->legacyTargets()->chunk(500) as $targets) {
                StoreLocationProductInventory::query()->insertOrIgnore($targets->map(fn ($target) => $target + [
                    'store_location_id' => $branch->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->values()->all());
            }
            $verified = $reconciliation->analyse($branch);
            if ($verified['missing_count'] || $verified['mismatch_count'] || $verified['extra_count']) {
                throw new \RuntimeException('Post-write reconciliation failed; transaction rolled back.');
            }
            BranchInventoryCutoverState::query()->updateOrCreate(
                ['store_location_id' => $branch->id],
                ['status' => BranchInventoryCutoverState::RECONCILED, 'reconciled_at' => now(), 'activated_at' => null, 'reconciliation_summary' => collect($verified)->except(['missing', 'mismatches'])->all()]
            );
        });
        $this->info('Backfill reconciled successfully. Authority was NOT activated; resolve documented blockers before activation.');
        return self::SUCCESS;
    }
}
