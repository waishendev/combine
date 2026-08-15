<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Services\Notifications\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendLowStockSummary extends Command
{
    protected $signature = 'ecommerce:send-low-stock-summary';

    protected $description = 'Send daily low stock summary to admins via email/whatsapp.';

    public function handle(NotificationService $notifications): int
    {
        $payload = [];
        $branchAuthorityActive = DB::table('branch_inventory_cutover_states')->where('status', BranchInventoryCutoverState::ACTIVE)->exists();

        $branchRows = $branchAuthorityActive ? DB::table('store_location_product_inventories as i')
            ->join('branch_inventory_cutover_states as cutover', fn ($join) => $join
                ->on('cutover.store_location_id', '=', 'i.store_location_id')->where('cutover.status', BranchInventoryCutoverState::ACTIVE))
            ->join('store_locations as branch', 'branch.id', '=', 'i.store_location_id')
            ->join('store_location_product as availability', fn ($join) => $join
                ->on('availability.store_location_id', '=', 'i.store_location_id')
                ->on('availability.product_id', '=', 'i.product_id')->where('availability.is_available', true))
            ->join('products as p', 'p.id', '=', 'i.product_id')
            ->leftJoin('product_variants as v', 'v.id', '=', 'i.product_variant_id')
            ->where('p.track_stock', true)
            ->whereRaw('COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0) > 0')
            ->whereRaw('i.quantity < COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0)')
            ->where(fn ($query) => $query
                ->where(fn ($variant) => $variant->whereNotNull('i.product_variant_id')->where('v.is_active', true)->where('v.is_bundle', false))
                ->orWhere(fn ($single) => $single->whereNull('i.product_variant_id')->whereNotExists(fn ($variants) => $variants
                    ->selectRaw('1')->from('product_variants as active_v')->whereColumn('active_v.product_id', 'p.id')->where('active_v.is_active', true))))
            ->selectRaw('branch.name as branch_name, branch.code as branch_code, p.sku as product_sku, p.name, p.cn_name, v.sku as variant_sku, v.title as variant_name, v.cn_name as variant_cn_name, i.quantity as stock, COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0) as threshold')
            ->get() : collect();

        if ($branchRows->isNotEmpty()) {
            $payload = $branchRows->map(fn ($row) => [
                'branch_name' => (string) $row->branch_name,
                'branch_code' => (string) ($row->branch_code ?? ''),
                'sku' => (string) ($row->variant_sku ?: $row->product_sku ?: ''),
                'name' => (string) ($row->name ?? ''),
                'cn_name' => (string) ($row->cn_name ?? ''),
                'variant_name' => $row->variant_name,
                'variant_cn_name' => $row->variant_cn_name,
                'stock' => (int) $row->stock,
                'threshold' => (int) $row->threshold,
            ])->all();
        }

        $lowStockProducts = ! $branchAuthorityActive ? Product::query()
            ->where('track_stock', true)
            ->where('low_stock_threshold', '>', 0)
            ->whereColumn('stock', '<', 'low_stock_threshold')
            ->whereDoesntHave('variants', fn ($q) => $q->where('is_active', true))
            ->get() : collect();

        foreach ($lowStockProducts as $p) {
            $payload[] = [
                'sku' => $p->sku ?? '',
                'name' => $p->name ?? '',
                'cn_name' => $p->cn_name ?? '',
                'variant_name' => null,
                'variant_cn_name' => null,
                'stock' => (int) $p->stock,
                'threshold' => (int) $p->low_stock_threshold,
            ];
        }

        $lowStockVariants = ! $branchAuthorityActive ? ProductVariant::query()
            ->with('product:id,name,cn_name,sku')
            ->where('track_stock', true)
            ->where('is_active', true)
            ->where('is_bundle', false)
            ->where('low_stock_threshold', '>', 0)
            ->whereColumn('stock', '<', 'low_stock_threshold')
            ->get() : collect();

        foreach ($lowStockVariants as $v) {
            $payload[] = [
                'sku' => $v->sku ?? $v->product?->sku ?? '',
                'name' => $v->product?->name ?? '',
                'cn_name' => $v->product?->cn_name ?? '',
                'variant_name' => $v->title ?? '',
                'variant_cn_name' => $v->cn_name ?? '',
                'stock' => (int) $v->stock,
                'threshold' => (int) $v->low_stock_threshold,
            ];
        }

        if (empty($payload)) {
            $this->info('No low stock products found.');
            return Command::SUCCESS;
        }

        $notifications->sendDailyLowStockSummary($payload);

        $this->info('Low stock summary sent for ' . count($payload) . ' items.');

        return Command::SUCCESS;
    }
}
