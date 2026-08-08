<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillProductBranches extends Command
{
    protected $signature = 'product-branch:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Add Product availability at an existing Branch (never writes inventory quantities)';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '' || ($this->option('dry-run') && $this->option('force')) || (! $this->option('dry-run') && ! $this->option('force'))) {
            $this->error('Provide an explicit --store-code and exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) {
            $this->error("Branch code [{$code}] does not exist; no Branch was created.");
            return self::FAILURE;
        }
        $assigned = DB::table('store_location_product')->where('store_location_id', $branch->id)->where('is_available', true)->count();
        $candidateIds = Product::query()->whereNotExists(fn ($q) => $q->selectRaw('1')->from('store_location_product')
            ->whereColumn('store_location_product.product_id', 'products.id')->where('store_location_id', $branch->id))->pluck('id');
        $this->line("Branch {$branch->name} ({$branch->code}): {$assigned} already assigned; {$candidateIds->count()} unassigned.");
        if ($this->option('dry-run')) {
            $this->info('Dry run: zero writes performed. Inventory quantities are never written by this command.');
            return self::SUCCESS;
        }
        $now = now();
        $inserted = 0;
        foreach ($candidateIds->chunk(500) as $ids) {
            $inserted += DB::table('store_location_product')->insertOrIgnore($ids->map(fn ($id) => [
                'store_location_id' => $branch->id, 'product_id' => $id, 'is_available' => true,
                'created_at' => $now, 'updated_at' => $now,
            ])->all());
        }
        $this->info("Assigned {$inserted} Products. Existing assignments were preserved; no inventory quantities were written.");
        return self::SUCCESS;
    }
}
