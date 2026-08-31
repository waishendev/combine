<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Services\PosPaymentMethodService;
use Illuminate\Console\Command;

class InitializePosPaymentMethods extends Command
{
    protected $signature = 'pos-payment-methods:initialize {--store-code=} {--dry-run} {--force}';
    protected $description = 'Explicitly initialize POS payment availability for one named Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') { $this->error('--store-code is required.'); return self::INVALID; }
        $store = StoreLocation::query()->whereRaw('LOWER(code) = ?', [strtolower($code)])->first();
        if (! $store) { $this->error("Store code {$code} was not found."); return self::FAILURE; }
        $configuration = app(PosPaymentMethodService::class)->configuration((int) $store->id);
        $exists = (bool) $configuration['is_configured'];
        $action = $exists ? ($this->option('force') ? 'replace explicit configuration' : 'no writes (already configured)') : 'initialize explicit configuration';
        $this->table(['Branch', 'Methods', 'Action'], [[$store->code, collect($configuration['methods'])->pluck('key')->join(', '), $action]]);
        if ($this->option('dry-run')) return self::SUCCESS;
        $written = app(PosPaymentMethodService::class)->initializeBranch((int) $store->id, (bool) $this->option('force'));
        if (! $written) { $this->info("POS payment configuration for {$store->code} is already initialized; no changes made."); return self::SUCCESS; }
        $this->info("POS payment configuration initialized for {$store->code}.");
        return self::SUCCESS;
    }
}
