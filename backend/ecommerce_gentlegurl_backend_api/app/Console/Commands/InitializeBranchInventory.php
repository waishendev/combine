<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\Ecommerce\ProductStockMovement;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InitializeBranchInventory extends Command
{
    protected $signature = 'branch-inventory:initialize {--file=} {--dry-run} {--force}';
    protected $description = 'Import independently reviewed per-Branch physical Product/Variant quantities without allocating global stock';

    public function handle(): int
    {
        $file = (string) $this->option('file');
        if ($file === '' || $this->option('dry-run') === $this->option('force') || ! is_file($file)) {
            $this->error('Provide an existing --file and exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        $rows = json_decode((string) file_get_contents($file), true);
        if (! is_array($rows)) {
            $this->error('Inventory file must be a JSON array.'); return self::FAILURE;
        }
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
                $inventory = StoreLocationProductInventory::query()->where($identity)->lockForUpdate()->first();
                $before = (int) ($inventory?->quantity ?? 0);
                StoreLocationProductInventory::query()->updateOrCreate($identity, ['quantity' => $row['quantity']]);
                ProductStockMovement::query()->firstOrCreate(
                    ['idempotency_key' => "inventory-init:{$sourceHash}:{$row['store_location_id']}:{$row['product_id']}:".($row['product_variant_id'] ?? 0)],
                    $identity + ['type' => 'initialization', 'quantity_before' => $before, 'quantity_change' => abs($row['quantity'] - $before), 'quantity_delta' => $row['quantity'] - $before, 'quantity_after' => $row['quantity'], 'remark' => 'Reviewed physical inventory initialization']
                );
            }
            foreach (collect($normalized)->groupBy('store_location_id') as $branchId => $branchRows) {
                BranchInventoryCutoverState::query()->updateOrCreate(['store_location_id' => $branchId], [
                    'status' => BranchInventoryCutoverState::RECONCILED, 'reconciled_at' => now(), 'activated_at' => null,
                    'reconciliation_summary' => ['physical_counts_reviewed' => true, 'source_sha256' => $sourceHash, 'row_count' => $branchRows->count()],
                ]);
            }
        });
        $this->info('Reviewed physical quantities initialized; authority remains RECONCILED, not ACTIVE.');
        return self::SUCCESS;
    }
}
