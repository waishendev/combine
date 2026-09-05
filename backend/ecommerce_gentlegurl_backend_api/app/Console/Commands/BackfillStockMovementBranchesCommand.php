<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillStockMovementBranchesCommand extends Command
{
    protected $signature = 'stock-movement-branch:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Attribute only NULL legacy Product Stock Movements to an explicitly selected Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '' || ((bool) $this->option('dry-run') === (bool) $this->option('force'))) {
            $this->error('Provide --store-code and exactly one of --dry-run or --force.');
            return self::INVALID;
        }
        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) {
            $this->error("Branch code [{$code}] was not found. No writes performed.");
            return self::FAILURE;
        }
        $pending = DB::table('product_stock_movements')->whereNull('store_location_id');
        $pendingCount = (clone $pending)->count();
        $attributed = DB::table('product_stock_movements')->whereNotNull('store_location_id')->count();
        $sample = (clone $pending)->orderBy('id')->limit(10)->pluck('id')->implode(', ');
        $this->table(['Target ID', 'Code', 'Name', 'NULL total', 'Already attributed', 'Would update', 'Unsafe'], [[
            $branch->id, $branch->code, $branch->name, $pendingCount, $attributed, $pendingCount, 0,
        ]]);
        if ($sample !== '') $this->line("Sample pending IDs: {$sample}");
        if ($this->option('dry-run')) {
            $this->info('Dry run complete. Zero writes performed.');
            return self::SUCCESS;
        }
        $updated = DB::table('product_stock_movements')->whereNull('store_location_id')->update([
            'store_location_id' => $branch->id,
            'updated_at' => now(),
        ]);
        $this->info("Updated {$updated} NULL Product Stock Movement row(s); attributed rows were preserved.");
        return self::SUCCESS;
    }
}
