<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Clone product availability from one Branch to another with zero stock.
 *
 * Cost is not stored per-branch on inventory rows; zero stock means Branch 2
 * starts with no inventory value until Stock Adjustment / stock-in.
 */
class CloneBranchProductCatalogCommand extends Command
{
    protected $signature = 'product-branch:clone-catalog
        {--from-id= : Source Branch store_locations.id}
        {--to-id= : Target Branch store_locations.id}
        {--from-code= : Source Branch code (alternative to --from-id)}
        {--to-code= : Target Branch code (alternative to --to-id)}
        {--dry-run : Preview only}
        {--force : Apply changes}';

    protected $description = 'Copy product availability from one Branch to another; target stock qty is 0 (no cost/inventory value yet)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        if ($dryRun === $force) {
            $this->error('Provide exactly one of --dry-run or --force.');
            $this->line('Example:');
            $this->line('  php artisan product-branch:clone-catalog --from-id=1 --to-id=3 --dry-run');
            $this->line('  php artisan product-branch:clone-catalog --from-id=1 --to-id=3 --force');

            return self::FAILURE;
        }

        $from = $this->resolveBranch(
            $this->option('from-id'),
            $this->option('from-code'),
            'source',
        );
        $to = $this->resolveBranch(
            $this->option('to-id'),
            $this->option('to-code'),
            'target',
        );
        if (! $from || ! $to) {
            return self::FAILURE;
        }
        if ((int) $from->id === (int) $to->id) {
            $this->error('Source and target Branch must be different.');

            return self::FAILURE;
        }

        $sourceProductIds = DB::table('store_location_product')
            ->where('store_location_id', $from->id)
            ->where('is_available', true)
            ->pluck('product_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $alreadyOnTarget = DB::table('store_location_product')
            ->where('store_location_id', $to->id)
            ->whereIn('product_id', $sourceProductIds)
            ->pluck('product_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $alreadyLookup = array_fill_keys($alreadyOnTarget, true);

        $missingProductIds = $sourceProductIds
            ->reject(fn (int $id) => isset($alreadyLookup[$id]))
            ->values();

        $targetCutoverActive = BranchInventoryCutoverState::query()
            ->where('store_location_id', $to->id)
            ->where('status', BranchInventoryCutoverState::ACTIVE)
            ->exists();

        $this->line("Source: #{$from->id} {$from->name} ({$from->code})");
        $this->line("Target: #{$to->id} {$to->name} ({$to->code})");
        $this->line("Available on source: {$sourceProductIds->count()}");
        $this->line('Already on target: '.count($alreadyOnTarget));
        $this->line("Will assign (new): {$missingProductIds->count()}");
        $this->line('Target Branch Inventory cutover: '.($targetCutoverActive ? 'ACTIVE' : 'not active'));
        $this->line('Inventory rows for newly assigned products: quantity = 0 (cost/value starts at 0 until stock-in).');
        $this->line('Existing target assignments / non-zero stock are left unchanged.');

        if ($dryRun) {
            $this->info('Dry run: zero writes performed.');

            return self::SUCCESS;
        }

        $now = now();
        $assigned = 0;
        $inventoryCreated = 0;

        DB::transaction(function () use ($to, $missingProductIds, $targetCutoverActive, $now, &$assigned, &$inventoryCreated) {
            foreach ($missingProductIds->chunk(200) as $chunk) {
                $rows = $chunk->map(fn (int $productId) => [
                    'store_location_id' => (int) $to->id,
                    'product_id' => $productId,
                    'is_available' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();

                $assigned += DB::table('store_location_product')->insertOrIgnore($rows);

                // Ensure already-present-but-unavailable rows become available.
                DB::table('store_location_product')
                    ->where('store_location_id', $to->id)
                    ->whereIn('product_id', $chunk->all())
                    ->update(['is_available' => true, 'updated_at' => $now]);
            }

            if (! $targetCutoverActive) {
                return;
            }

            $products = Product::query()
                ->whereIn('id', $missingProductIds->all())
                ->with(['variants' => fn ($q) => $q->where('is_bundle', false)->select(['id', 'product_id'])])
                ->get(['id', 'type']);

            foreach ($products as $product) {
                $variantIds = $product->variants->pluck('id')->map(fn ($id) => (int) $id)->all();

                if ($variantIds === []) {
                    $created = StoreLocationProductInventory::query()->firstOrCreate(
                        [
                            'store_location_id' => (int) $to->id,
                            'product_id' => (int) $product->id,
                            'product_variant_id' => null,
                        ],
                        ['quantity' => 0],
                    );
                    if ($created->wasRecentlyCreated) {
                        $inventoryCreated++;
                    }
                    continue;
                }

                foreach ($variantIds as $variantId) {
                    $created = StoreLocationProductInventory::query()->firstOrCreate(
                        [
                            'store_location_id' => (int) $to->id,
                            'product_id' => (int) $product->id,
                            'product_variant_id' => $variantId,
                        ],
                        ['quantity' => 0],
                    );
                    if ($created->wasRecentlyCreated) {
                        $inventoryCreated++;
                    }
                }
            }
        });

        // Also ensure inventory placeholders for products that were already assigned
        // on target but missing inventory rows (still qty 0 only via firstOrCreate).
        if ($targetCutoverActive && $sourceProductIds->isNotEmpty()) {
            $extraCreated = 0;
            Product::query()
                ->whereIn('id', $sourceProductIds->all())
                ->with(['variants' => fn ($q) => $q->where('is_bundle', false)->select(['id', 'product_id'])])
                ->orderBy('id')
                ->chunkById(100, function ($products) use ($to, &$extraCreated) {
                    foreach ($products as $product) {
                        $variantIds = $product->variants->pluck('id')->map(fn ($id) => (int) $id)->all();
                        if ($variantIds === []) {
                            $row = StoreLocationProductInventory::query()->firstOrCreate(
                                [
                                    'store_location_id' => (int) $to->id,
                                    'product_id' => (int) $product->id,
                                    'product_variant_id' => null,
                                ],
                                ['quantity' => 0],
                            );
                            if ($row->wasRecentlyCreated) {
                                $extraCreated++;
                            }
                            continue;
                        }
                        foreach ($variantIds as $variantId) {
                            $row = StoreLocationProductInventory::query()->firstOrCreate(
                                [
                                    'store_location_id' => (int) $to->id,
                                    'product_id' => (int) $product->id,
                                    'product_variant_id' => $variantId,
                                ],
                                ['quantity' => 0],
                            );
                            if ($row->wasRecentlyCreated) {
                                $extraCreated++;
                            }
                        }
                    }
                });
            $inventoryCreated += $extraCreated;
        }

        $this->info("Done. Assigned/updated availability for {$missingProductIds->count()} product(s); created {$inventoryCreated} inventory row(s) at qty 0.");
        $this->line('Existing non-zero stock on target Branch was not overwritten.');

        return self::SUCCESS;
    }

    private function resolveBranch(mixed $idOption, mixed $codeOption, string $label): ?StoreLocation
    {
        $id = (int) ($idOption ?? 0);
        $code = trim((string) ($codeOption ?? ''));

        if ($id <= 0 && $code === '') {
            $this->error("Provide --{$label} via --from-id/--to-id or --from-code/--to-code.");

            return null;
        }

        $branch = $id > 0
            ? StoreLocation::query()->find($id)
            : StoreLocation::query()->where('code', $code)->first();

        if (! $branch) {
            $this->error("{$label} Branch not found.");

            return null;
        }

        if (! $branch->is_active) {
            $this->error("{$label} Branch #{$branch->id} ({$branch->code}) is inactive.");

            return null;
        }

        return $branch;
    }
}
