<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\PosPaymentMethod;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InitializePosPaymentMethods extends Command
{
    protected $signature = 'pos-payment-methods:initialize {--store-code=} {--dry-run} {--force}';
    protected $description = 'Explicitly initialize legacy POS payment availability for one Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') { $this->error('--store-code is required.'); return self::INVALID; }
        $store = StoreLocation::query()->whereRaw('LOWER(code) = ?', [strtolower($code)])->first();
        if (! $store) { $this->error("Store code {$code} was not found."); return self::FAILURE; }
        $methods = PosPaymentMethod::query()->orderBy('default_sort_order')->get();
        $exists = DB::table('store_location_pos_payment_methods')->where('store_location_id', $store->id)->exists();
        $this->table(['Branch', 'Methods', 'Action'], [[$store->code, $methods->pluck('key')->join(', '), $exists ? 'replace existing configuration' : 'initialize legacy configuration']]);
        if ($this->option('dry-run')) return self::SUCCESS;
        if ($exists && ! $this->option('force')) { $this->error('Configuration exists; pass --force to replace it.'); return self::FAILURE; }
        DB::transaction(function () use ($store, $methods) {
            DB::table('store_location_pos_payment_methods')->where('store_location_id', $store->id)->delete();
            foreach ($methods as $method) DB::table('store_location_pos_payment_methods')->insert([
                'store_location_id' => $store->id, 'pos_payment_method_id' => $method->id,
                'is_enabled' => true, 'sort_order' => $method->default_sort_order, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('store_location_pos_payment_settings')->updateOrInsert(['store_location_id' => $store->id], [
                'allow_split_payment' => true, 'auto_calculate_split' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        });
        $this->info("Legacy POS behavior initialized for {$store->code}.");
        return self::SUCCESS;
    }
}
