<?php

namespace App\Services;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Applies an operator-approved, single-store legacy fact to Orders.
 *
 * This deliberately does not infer ownership from mutable product, inventory,
 * staff, or Branch availability data. It is an operator-run rollout action, not
 * a repair mechanism for NULL Orders created after Multi-Branch activation.
 */
class LegacyOrderBranchBackfillService
{
    public function preview(StoreLocation $branch): array
    {
        $null = Order::query()->whereNull('store_location_id');

        return [
            'target' => ['id' => (int) $branch->id, 'code' => $branch->code, 'name' => $branch->name],
            'total_null' => (clone $null)->count(),
            'rows_would_be_updated' => (clone $null)->count(),
            'already_attributed' => Order::query()->whereNotNull('store_location_id')->count(),
            'earliest_null' => (clone $null)->min('created_at'),
            'latest_null' => (clone $null)->max('created_at'),
            'breakdown' => $this->breakdown($null),
            'null_by_date' => (clone $null)->selectRaw('DATE(created_at) as order_date, COUNT(*) as aggregate')
                ->groupByRaw('DATE(created_at)')->orderBy('order_date')->pluck('aggregate', 'order_date')->all(),
            'sample_order_ids' => (clone $null)->orderBy('id')->limit(10)->pluck('id')->map(fn ($id) => (int) $id)->all(),
            'product_profit_order_count' => $this->withProductLines(clone $null)->count(),
            'sample_product_profit_order_ids' => $this->withProductLines(clone $null)->orderBy('id')->limit(10)->pluck('id')->map(fn ($id) => (int) $id)->all(),
        ];
    }

    public function run(StoreLocation $branch): array
    {
        return DB::transaction(function () use ($branch) {
            $preview = $this->preview($branch);
            $changed = Order::query()->whereNull('store_location_id')->update(['store_location_id' => $branch->id]);

            return $preview + ['orders_changed' => $changed];
        });
    }

    private function withProductLines(Builder $query): Builder
    {
        return $query->whereExists(fn ($items) => $items->selectRaw('1')->from('order_items')
            ->whereColumn('order_items.order_id', 'orders.id')->whereNotNull('order_items.product_id')
            ->where(fn ($line) => $line->whereNull('line_type')->orWhere('line_type', 'product')));
    }

    private function breakdown(Builder $nullOrders): array
    {
        $ids = (clone $nullOrders)->pluck('id');
        $rows = Order::query()->whereIn('id', $ids)->with('items:id,order_id,booking_id,line_type,product_id')->get();
        $counts = array_fill_keys(['pos', 'ecommerce', 'booking_settlement', 'product_only', 'package', 'staff_consumables', 'unknown_other'], 0);

        foreach ($rows as $order) {
            $types = $order->items->pluck('line_type')->filter()->map(fn ($type) => strtolower((string) $type));
            $matchedType = false;
            if ($order->created_by_user_id !== null) $counts['pos']++;
            else $counts['ecommerce']++;
            if (str_contains((string) $order->notes, 'staff_free_consumable_claim')) { $counts['staff_consumables']++; $matchedType = true; }
            if ($types->contains(fn ($value) => str_contains($value, 'package'))) { $counts['package']++; $matchedType = true; }
            if ($order->items->contains(fn ($item) => $item->booking_id !== null) || $types->contains(fn ($value) => str_contains($value, 'settlement'))) { $counts['booking_settlement']++; $matchedType = true; }
            if ($order->items->isNotEmpty() && $order->items->every(fn ($item) => $item->product_id !== null && ($item->line_type === null || $item->line_type === 'product'))) { $counts['product_only']++; $matchedType = true; }
            if (! $matchedType) $counts['unknown_other']++;
        }

        return $counts;
    }
}
