<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InitializeBranchInventory extends Command
{
    protected $signature = 'branch-inventory:initialize {--file=} {--store-code=} {--from-global} {--dry-run} {--force}';
    protected $description = 'Initialize reviewed Branch quantities from JSON or migrate one explicitly confirmed legacy Branch from global stock';

    public function handle(): int
    {
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Provide exactly one of --dry-run or --force.');
            return self::FAILURE;
        }

        $fromGlobal = (bool) $this->option('from-global');
        $file = trim((string) $this->option('file'));
        $storeCode = trim((string) $this->option('store-code'));
        if ($fromGlobal) {
            if ($file !== '' || $storeCode === '') {
                $this->error('--from-global requires --store-code and cannot be combined with --file.');
                return self::FAILURE;
            }
            return $this->initializeFromGlobal($storeCode);
        }
        if ($storeCode !== '' || $file === '' || ! is_file($file)) {
            $this->error('JSON mode requires an existing --file and does not accept --store-code.');
            return self::FAILURE;
        }
        return $this->initializeFromReviewedFile($file);
    }

    private function initializeFromGlobal(string $storeCode): int
    {
        $branch = StoreLocation::query()->where('code', $storeCode)->first();
        if (! $branch || ! $branch->is_active) {
            $this->error($branch ? 'The specified Branch is inactive.' : 'The specified Branch code does not exist.');
            return self::FAILURE;
        }
        $state = BranchInventoryCutoverState::query()->where('store_location_id', $branch->id)->first();
        if ($state?->status === BranchInventoryCutoverState::ACTIVE) {
            $this->error('Cannot initialize an ACTIVE Branch.');
            return self::FAILURE;
        }

        $duplicateCount = StoreLocationProductInventory::query()
            ->select(['store_location_id', 'product_id', 'product_variant_id'])
            ->groupBy(['store_location_id', 'product_id', 'product_variant_id'])->havingRaw('COUNT(*) > 1')->count();
        $otherNonZero = StoreLocationProductInventory::query()
            ->where('store_location_id', '!=', $branch->id)->where('quantity', '!=', 0)
            ->whereHas('storeLocation', fn ($query) => $query->where('is_active', true))->count();
        $rows = collect(); $skipped = collect(); $mappingErrors = collect();

        Product::query()->with(['variants' => fn ($query) => $query->orderBy('id')])->orderBy('id')->chunk(250,
            function ($products) use ($branch, $rows, $skipped, $mappingErrors) {
                foreach ($products as $product) {
                    if (! $product->track_stock) {
                        $skipped->push("Product {$product->id}: stock tracking is disabled");
                        continue;
                    }
                    $variants = $product->variants;
                    $stockVariants = $variants->where('is_bundle', false);
                    foreach ($variants->where('is_bundle', true) as $bundle) {
                        $skipped->push("Product {$product->id} Variant {$bundle->id}: bundle stock is derived from components");
                    }
                    if ($stockVariants->isNotEmpty()) {
                        foreach ($stockVariants as $variant) {
                            if (! $variant->track_stock) {
                                $skipped->push("Product {$product->id} Variant {$variant->id}: stock tracking is disabled");
                                continue;
                            }
                            $this->pushGlobalMapping($rows, $mappingErrors, $branch->id, $product->id, $variant->id, $variant->stock);
                        }
                        continue;
                    }
                    if ($variants->isNotEmpty()) {
                        $skipped->push("Product {$product->id}: contains only derived bundle Variants");
                        continue;
                    }
                    $this->pushGlobalMapping($rows, $mappingErrors, $branch->id, $product->id, null, $product->resolvedStockQuantity());
                }
            });

        $existing = StoreLocationProductInventory::query()->where('store_location_id', $branch->id)->get()
            ->keyBy(fn ($row) => $this->identity((int) $row->product_id, $row->product_variant_id ? (int) $row->product_variant_id : null));
        $mapped = $rows->keyBy(fn ($row) => $this->identity($row['product_id'], $row['product_variant_id']));
        $conflicts = $rows->filter(function ($row) use ($existing) {
            $current = $existing->get($this->identity($row['product_id'], $row['product_variant_id']));
            return $current && (int) $current->quantity !== 0 && (int) $current->quantity !== $row['quantity'];
        });
        $unmappedTarget = $existing->filter(fn ($row) => (int) $row->quantity !== 0
            && ! $mapped->has($this->identity((int) $row->product_id, $row->product_variant_id ? (int) $row->product_variant_id : null)));
        $reviewedByAnotherMode = (bool) data_get($state?->reconciliation_summary, 'physical_counts_reviewed', false)
            && data_get($state?->reconciliation_summary, 'initialization_mode') !== 'from_global';

        $this->info("Target Branch: {$branch->code} — {$branch->name}");
        $this->line('Products: '.$rows->whereNull('product_variant_id')->count());
        $this->line('Variants: '.$rows->whereNotNull('product_variant_id')->count());
        $this->line('Total quantity to initialize: '.$rows->sum('quantity'));
        $this->line('Existing target inventory rows: '.$existing->count());
        $this->line('Conflicts/mismatches: '.($conflicts->count() + $unmappedTarget->count()));
        $this->line('Other active Branch non-zero rows: '.$otherNonZero);
        $this->line('Skipped: '.$skipped->count());
        $this->table(['Product', 'Variant', 'Legacy quantity', 'Existing target quantity'], $rows->map(function ($row) use ($existing) {
            $current = $existing->get($this->identity($row['product_id'], $row['product_variant_id']));
            return [$row['product_id'], $row['product_variant_id'] ?? '—', $row['quantity'], $current?->quantity ?? '—'];
        })->all());
        foreach ($skipped as $reason) { $this->warn('skipped: '.$reason); }

        if ($duplicateCount || $otherNonZero || $mappingErrors->isNotEmpty() || $conflicts->isNotEmpty() || $unmappedTarget->isNotEmpty() || $reviewedByAnotherMode) {
            if ($duplicateCount) { $this->error("Duplicate inventory identities: {$duplicateCount}"); }
            if ($otherNonZero) { $this->error('Another active Branch already contains non-zero physical inventory.'); }
            foreach ($mappingErrors as $error) { $this->error($error); }
            if ($conflicts->isNotEmpty() || $unmappedTarget->isNotEmpty()) { $this->error('Target Branch contains conflicting physical inventory.'); }
            if ($reviewedByAnotherMode) { $this->error('Target Branch contains reviewed inventory from another initialization mode.'); }
            if ($this->option('dry-run')) { $this->info('Dry run failed safely: zero writes occurred.'); }
            return self::FAILURE;
        }
        if ($this->option('dry-run')) {
            $this->info('Dry run complete: zero writes occurred.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($branch, $rows) {
            foreach ($rows as $row) {
                $identity = collect($row)->only(['store_location_id', 'product_id', 'product_variant_id'])->all();
                $inventory = StoreLocationProductInventory::query()->where($identity)->lockForUpdate()->first();
                $before = (int) ($inventory?->quantity ?? 0);
                StoreLocationProductInventory::query()->updateOrCreate($identity, ['quantity' => $row['quantity']]);
                ProductStockMovement::query()->firstOrCreate(
                    ['idempotency_key' => "inventory-init:from-global:{$branch->id}:{$row['product_id']}:".($row['product_variant_id'] ?? 0)],
                    $identity + ['type' => 'initialization', 'quantity_before' => $before, 'quantity_change' => abs($row['quantity'] - $before), 'quantity_delta' => $row['quantity'] - $before, 'quantity_after' => $row['quantity'], 'remark' => "Initial legacy global stock migration to Branch {$branch->code}"]
                );
            }
            BranchInventoryCutoverState::query()->updateOrCreate(['store_location_id' => $branch->id], [
                'status' => BranchInventoryCutoverState::RECONCILED, 'reconciled_at' => now(), 'activated_at' => null,
                'reconciliation_summary' => ['physical_counts_reviewed' => true, 'initialization_mode' => 'from_global', 'store_code' => $branch->code, 'row_count' => $rows->count()],
            ]);
        });
        $this->info('Legacy stock initialized only at the specified Branch; authority remains RECONCILED, not ACTIVE.');
        return self::SUCCESS;
    }

    private function pushGlobalMapping(Collection $rows, Collection $errors, int $branchId, int $productId, ?int $variantId, mixed $stock): void
    {
        if (! is_numeric($stock) || (int) $stock < 0 || (float) $stock !== (float) (int) $stock) {
            $errors->push("Product {$productId}".($variantId ? " Variant {$variantId}" : '').': legacy stock cannot be mapped safely.');
            return;
        }
        $rows->push(['store_location_id' => $branchId, 'product_id' => $productId, 'product_variant_id' => $variantId, 'quantity' => (int) $stock]);
    }

    private function identity(int $productId, ?int $variantId): string
    {
        return $productId.':'.($variantId ?? 0);
    }

    private function initializeFromReviewedFile(string $file): int
    {
        $rows = json_decode((string) file_get_contents($file), true);
        if (! is_array($rows)) { $this->error('Inventory file must be a JSON array.'); return self::FAILURE; }
        $branches = StoreLocation::query()->whereIn('code', collect($rows)->pluck('store_code')->unique())->get()->keyBy('code');
        $products = Product::query()->whereIn('id', collect($rows)->pluck('product_id')->unique())->get()->keyBy('id');
        $variants = ProductVariant::query()->whereIn('id', collect($rows)->pluck('product_variant_id')->filter()->unique())->get()->keyBy('id');
        $normalized = []; $errors = []; $seen = [];
        foreach ($rows as $index => $row) {
            $branch = $branches->get((string) ($row['store_code'] ?? '')); $product = $products->get((int) ($row['product_id'] ?? 0));
            $variantId = empty($row['product_variant_id']) ? null : (int) $row['product_variant_id']; $variant = $variantId ? $variants->get($variantId) : null;
            $qty = filter_var($row['quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
            $key = ($branch?->id ?? 0).':'.($product?->id ?? 0).':'.($variantId ?? 0);
            if (! $branch || ! $branch->is_active || ! $product || $qty === false || ($variantId && (! $variant || (int) $variant->product_id !== (int) $product->id)) || isset($seen[$key])) {
                $errors[] = ['row' => $index + 1, 'reason' => isset($seen[$key]) ? 'duplicate identity' : 'invalid Branch/Product/Variant/quantity']; continue;
            }
            if (BranchInventoryCutoverState::query()->where('store_location_id', $branch->id)->where('status', BranchInventoryCutoverState::ACTIVE)->exists()) {
                $errors[] = ['row' => $index + 1, 'reason' => 'cannot overwrite ACTIVE Branch inventory']; continue;
            }
            $seen[$key] = true; $normalized[] = ['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variantId, 'quantity' => $qty];
        }
        $this->line('rows: '.count($rows)); $this->line('valid: '.count($normalized)); $this->line('errors: '.count($errors));
        foreach ($errors as $error) { $this->warn("row {$error['row']}: {$error['reason']}"); }
        if ($errors !== []) { return self::FAILURE; }
        if ($this->option('dry-run')) { $this->info('Dry run: zero writes.'); return self::SUCCESS; }
        DB::transaction(function () use ($normalized, $file) {
            $sourceHash = hash_file('sha256', $file);
            foreach ($normalized as $row) {
                $identity = collect($row)->only(['store_location_id', 'product_id', 'product_variant_id'])->all();
                $inventory = StoreLocationProductInventory::query()->where($identity)->lockForUpdate()->first(); $before = (int) ($inventory?->quantity ?? 0);
                StoreLocationProductInventory::query()->updateOrCreate($identity, ['quantity' => $row['quantity']]);
                ProductStockMovement::query()->firstOrCreate(['idempotency_key' => "inventory-init:{$sourceHash}:{$row['store_location_id']}:{$row['product_id']}:".($row['product_variant_id'] ?? 0)],
                    $identity + ['type' => 'initialization', 'quantity_before' => $before, 'quantity_change' => abs($row['quantity'] - $before), 'quantity_delta' => $row['quantity'] - $before, 'quantity_after' => $row['quantity'], 'remark' => 'Reviewed physical inventory initialization']);
            }
            foreach (collect($normalized)->groupBy('store_location_id') as $branchId => $branchRows) {
                BranchInventoryCutoverState::query()->updateOrCreate(['store_location_id' => $branchId], ['status' => BranchInventoryCutoverState::RECONCILED, 'reconciled_at' => now(), 'activated_at' => null,
                    'reconciliation_summary' => ['physical_counts_reviewed' => true, 'initialization_mode' => 'reviewed_json', 'source_sha256' => $sourceHash, 'row_count' => $branchRows->count()]]);
            }
        });
        $this->info('Reviewed physical quantities initialized; authority remains RECONCILED, not ACTIVE.');
        return self::SUCCESS;
    }
}
