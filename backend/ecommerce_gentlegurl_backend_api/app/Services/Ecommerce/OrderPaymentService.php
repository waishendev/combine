<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use App\Models\Ecommerce\StockMovement;
use App\Services\Booking\CustomerServicePackageService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class OrderPaymentService
{
    public function handlePaid(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $this->deductStock($order);
            app(CustomerServicePackageService::class)->fulfillPendingPackagesForPaidOrder($order->fresh(['items', 'customer']));
            $this->issuePoints($order);
        });
    }

    protected function deductStock(Order $order): void
    {
        $items = $order->items()
            ->whereNotNull('product_id')
            ->where(function ($query) {
                $query->whereNull('line_type')
                    ->orWhere('line_type', 'product');
            })
            ->get();

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

        if (PointsTransaction::query()->where('customer_id', $order->customer_id)->where('type', 'earn')
            ->where('source_type', Order::class)->where('source_id', $order->id)->exists()) {
            return;
        }

        $setting = LoyaltySetting::active();
        $tierMultiplier = MembershipTierRule::where('tier', $order->customer->tier)->value('multiplier') ?? 1;

        $isBooking = $order->items()->whereIn('line_type', ['booking_deposit', 'booking_addon'])->exists();
        $channelRate = $isBooking ? $setting?->booking_earning_rate : $setting?->ecommerce_earning_rate;
        $baseMultiplier = $channelRate ?? $setting?->base_multiplier ?? 1;
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
