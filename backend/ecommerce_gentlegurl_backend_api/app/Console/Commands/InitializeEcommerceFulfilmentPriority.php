<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Services\Ecommerce\ShippingFulfillmentPriorityService;
use Illuminate\Console\Command;

class InitializeEcommerceFulfilmentPriority extends Command
{
    protected $signature = 'ecommerce-fulfilment-priority:initialize {--store-code=} {--dry-run} {--force}';

    protected $description = 'Safely initialize or reconcile Ecommerce shipping Branch priority';

    public function handle(ShippingFulfillmentPriorityService $priority): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') {
            $this->error('--store-code is required.');
            return self::INVALID;
        }
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::INVALID;
        }

        $store = StoreLocation::query()->whereRaw('LOWER(code) = ?', [strtolower($code)])->first();
        if (! $store) {
            $this->error("Store code {$code} was not found.");
            return self::FAILURE;
        }

        $report = $this->option('force') ? $priority->reconcile($store) : $priority->preview($store);
        $labels = StoreLocation::query()->whereIn('id', array_unique(array_merge($report['current'], $report['proposed'])))
            ->get()->mapWithKeys(fn ($branch) => [(int) $branch->id => "{$branch->code} (#{$branch->id})"]);
        $format = fn (array $ids) => collect($ids)->map(fn ($id) => $labels->get($id, "missing Branch #{$id}"))->join(' -> ') ?: '(empty)';

        $this->table(['Current priority', 'Missing Branches', 'Proposed priority'], [[
            $format($report['current']), $format($report['missing']), $format($report['proposed']),
        ]]);
        $this->info($this->option('dry-run')
            ? 'DRY RUN: zero writes performed.'
            : ($report['changed'] ? 'Priority reconciled; existing order was preserved.' : 'Priority already reconciled; no changes made.'));

        return self::SUCCESS;
    }
}
