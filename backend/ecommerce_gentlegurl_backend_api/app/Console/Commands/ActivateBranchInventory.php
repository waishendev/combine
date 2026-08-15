<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Services\Ecommerce\BranchInventoryActivationReadinessService;
use App\Services\Ecommerce\BranchInventoryProjectionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ActivateBranchInventory extends Command
{
    protected $signature = 'branch-inventory:activate {--dry-run} {--force} {--confirm=}';
    protected $description = 'Fail-closed coordinated activation of all reviewed physical Branch inventories';

    public function handle(BranchInventoryActivationReadinessService $readiness, BranchInventoryProjectionService $projection): int
    {
        if ($this->option('dry-run') === $this->option('force')) {
            $this->error('Provide exactly one of --dry-run or --force.'); return self::FAILURE;
        }
        $report = $readiness->analyse();
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        if (! $report['ready']) { $this->error('Activation readiness failed closed.'); return self::FAILURE; }
        if ($this->option('dry-run')) { $this->info('Dry run: zero authority changes.'); return self::SUCCESS; }
        if ((string) $this->option('confirm') !== 'ACTIVATE_BRANCH_INVENTORY') {
            $this->error('Force requires --confirm=ACTIVATE_BRANCH_INVENTORY.'); return self::FAILURE;
        }
        DB::transaction(function () use ($report, $projection) {
            BranchInventoryCutoverState::query()->whereIn('store_location_id', collect($report['branches'])->pluck('id'))
                ->update(['status' => BranchInventoryCutoverState::ACTIVE, 'activated_at' => now(), 'updated_at' => now()]);
            $projection->projectAll();
        });
        $this->info('All active physical Branches activated together.');
        return self::SUCCESS;
    }
}
