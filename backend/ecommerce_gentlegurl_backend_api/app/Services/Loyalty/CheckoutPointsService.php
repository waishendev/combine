<?php

namespace App\Services\Loyalty;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class CheckoutPointsService
{
    public function __construct(private readonly PointsService $points) {}

    public function quote(Customer $customer, string $channel, float $payable, int $requested = 0): array
    {
        $setting = LoyaltySetting::active();
        $prefix = $channel === 'booking' ? 'booking' : 'ecommerce';
        $enabled = (bool) ($setting?->{"{$prefix}_redemption_enabled"} ?? false);
        $valueSen = (int) ($setting?->{"{$prefix}_point_value_sen"} ?? 0);
        $percent = (float) ($setting?->{"{$prefix}_max_redemption_percent"} ?? 0);
        $available = $this->points->getAvailableBalance($customer);
        $payableSen = max(0, (int) round($payable * 100));

        if ($requested > 0 && (!$enabled || $valueSen <= 0)) {
            throw ValidationException::withMessages(['loyalty_points' => __('Loyalty Points redemption is currently unavailable.')]);
        }

        $capSen = min($payableSen, (int) floor($payableSen * $percent / 100));
        $maximum = $enabled && $valueSen > 0 ? min($available, intdiv($capSen, $valueSen)) : 0;
        if ($requested > $available) {
            throw ValidationException::withMessages(['loyalty_points' => __('You do not have enough Loyalty Points.')]);
        }
        if ($requested > $maximum) {
            throw ValidationException::withMessages(['loyalty_points' => __('You can use a maximum of :points Points for this checkout.', ['points' => number_format($maximum)])]);
        }

        return [
            'enabled' => $enabled,
            'available_points' => $available,
            'point_value_sen' => $valueSen,
            'point_value' => $valueSen / 100,
            'maximum_percentage' => $percent,
            'maximum_points' => $maximum,
            'maximum_discount' => round($maximum * $valueSen / 100, 2),
            'points_used' => $requested,
            'discount' => round($requested * $valueSen / 100, 2),
        ];
    }

    /** Must be called inside the checkout database transaction. */
    public function deduct(Customer $customer, Model $source, string $channel, int $points, float $payable): array
    {
        if ($points <= 0) return $this->quote($customer, $channel, $payable);

        $existing = PointsTransaction::query()->where('customer_id', $customer->id)
            ->where('type', 'redeem')->where('source_type', $source::class)->where('source_id', $source->getKey())
            ->lockForUpdate()->first();
        if ($existing) return (array) ($existing->meta['loyalty_snapshot'] ?? []);

        $quote = $this->quote($customer, $channel, $payable, $points);
        $remaining = $points;
        $batchItems = [];
        $batches = PointsEarnBatch::query()->where('customer_id', $customer->id)->where('status', 'active')
            ->where('points_remaining', '>', 0)->where('expires_at', '>', Carbon::now())
            ->orderBy('earned_at')->lockForUpdate()->get();
        foreach ($batches as $batch) {
            if ($remaining === 0) break;
            $used = min($remaining, (int) $batch->points_remaining);
            $batch->decrement('points_remaining', $used);
            $batchItems[] = ['batch_id' => $batch->id, 'points' => $used];
            $remaining -= $used;
        }
        if ($remaining > 0) throw ValidationException::withMessages(['loyalty_points' => __('You do not have enough Loyalty Points.')]);

        PointsTransaction::create([
            'customer_id' => $customer->id, 'type' => 'redeem', 'points_change' => -$points,
            'source_type' => $source::class, 'source_id' => $source->getKey(),
            'meta' => ['channel' => $channel, 'batches' => $batchItems, 'loyalty_snapshot' => $quote],
        ]);
        return $quote;
    }
}
