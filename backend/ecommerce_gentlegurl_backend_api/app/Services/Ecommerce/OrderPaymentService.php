<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use App\Models\Ecommerce\StockMovement;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class OrderPaymentService
{
    public function handlePaid(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $this->deductStock($order);
            $this->issuePoints($order);
        });
    }

    protected function deductStock(Order $order): void
    {
        $items = $order->items;
        foreach ($items as $item) {
            /** @var OrderItem $item */
            StockMovement::create([
                'product_id' => $item->product_id,
                'change' => -1 * (int) $item->quantity,
                'reason' => 'order',
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'created_by' => null,
            ]);
        }
    }

    protected function issuePoints(Order $order): void
    {
        if (!$order->customer_id) {
            return;
        }

        $setting = LoyaltySetting::orderByDesc('created_at')->first();
        $tierMultiplier = MembershipTierRule::where('tier', $order->customer->tier)->value('multiplier') ?? 1;

        $baseMultiplier = $setting?->base_multiplier ?? 1;
        $expiryMonths = $setting?->expiry_months ?? 12;

        $rawPoints = (float) $order->grand_total * $baseMultiplier * $tierMultiplier;
        $points = (int) round($rawPoints);
        if ($points <= 0) {
            return;
        }

        $batch = PointsEarnBatch::create([
            'customer_id' => $order->customer_id,
            'points_total' => $points,
            'points_remaining' => $points,
            'earned_at' => Carbon::now(),
            'expires_at' => Carbon::now()->addMonths($expiryMonths),
            'source_type' => Order::class,
            'source_id' => $order->id,
        ]);

        PointsTransaction::create([
            'customer_id' => $order->customer_id,
            'type' => 'earn',
            'points_change' => $points,
            'source_type' => Order::class,
            'source_id' => $order->id,
            'meta' => [
                'order_no' => $order->order_no ?? $order->id,
                'earn_batch_id' => $batch->id,
            ],
        ]);
    }
}
