<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillProductBranchAvailability extends Command
{
    protected $signature = 'product-branch:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Assign missing legacy Products to one explicitly selected active Branch without changing inventory or existing assignments';

    public function handle(): int
    {
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Provide exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        $code = trim((string) $this->option('store-code'));
        $branch = $code === '' ? null : StoreLocation::query()->where('code', $code)->first();
        if (! $branch || ! $branch->is_active) {
            $this->error($branch ? 'The specified Branch is inactive.' : 'The specified Branch code does not exist.');
            return self::FAILURE;
        }

        $total = Product::query()->count();
        $existing = DB::table('store_location_product')->where('store_location_id', $branch->id)->count();
        $missing = Product::query()->whereDoesntHave('storeLocations', fn ($query) => $query->where('store_locations.id', $branch->id))->count();
        $this->info("Target Branch: {$branch->code} — {$branch->name}");
        $this->line("Products: {$total}");
        $this->line("Existing assignments preserved: {$existing}");
        $this->line("Missing assignments to create: {$missing}");

        if ($this->option('dry-run')) {
            $this->info('Dry run complete: zero writes occurred; inventory quantities are unchanged.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($branch) {
            Product::query()->select('id')->orderBy('id')->chunkById(500, function ($products) use ($branch) {
                $now = now();
                DB::table('store_location_product')->insertOrIgnore($products->map(fn ($product) => [
                    'store_location_id' => $branch->id,
                    'product_id' => $product->id,
                    'is_available' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            });
        });
        $this->info("Created {$missing} missing Product availability assignments at {$branch->code}; existing assignments and inventory were not changed.");
        return self::SUCCESS;
    }
}
