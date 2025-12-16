<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MembershipTierService
{
    public function getActiveRuleForTier(?string $tier): ?MembershipTierRule
    {
        if (!$tier) {
            return null;
        }

        return MembershipTierRule::query()
            ->where('tier', $tier)
            ->where('is_active', true)
            ->first();
    }

    public function buildLoyaltyProgress(Customer $customer): array
    {
        $currentRule = $this->getActiveRuleForTier($customer->tier);

        $currentTier = $this->formatTierData($currentRule);
        $windowMonths = $currentRule?->months_window ?? 0;

        $now = Carbon::now();
        $windowStart = $now->copy()->subMonths($windowMonths);

        $totalSpent = (float) Order::query()
            ->where('customer_id', $customer->id)
            ->where(function ($query) {
                $query->where('payment_status', 'paid')
                    ->orWhere('status', 'completed');
            })
            ->when($windowMonths > 0, function ($query) use ($windowStart, $now) {
                $query->whereBetween(DB::raw('COALESCE(placed_at, created_at)'), [$windowStart, $now]);
            })
            ->sum('grand_total');

        $currentMinSpend = (float) ($currentRule?->min_spent_last_x_months ?? 0);
        $nextRule = $currentRule ? MembershipTierRule::query()
            ->where('is_active', true)
            ->where('min_spent_last_x_months', '>', $currentRule->min_spent_last_x_months)
            ->orderBy('min_spent_last_x_months')
            ->first() : null;

        $nextTier = $this->formatTierData($nextRule);

        if ($nextRule) {
            $nextMinSpend = (float) $nextRule->min_spent_last_x_months;
            $amountToNextTier = max($nextMinSpend - $totalSpent, 0);
            $progressPercent = $this->clamp(($totalSpent / $nextMinSpend) * 100);
        } else {
            $amountToNextTier = 0;
            $progressPercent = 100;
        }

        $tierReviewAt = $customer->tier_effective_at
            ? $customer->tier_effective_at->copy()->addMonths($windowMonths)
            : null;

        return [
            'current_tier' => $currentTier,
            'spending' => [
                'window_months' => $windowMonths,
                'total_spent' => $totalSpent,
                'current_tier_min_spend' => $currentMinSpend,
                'next_tier' => $nextTier,
                'amount_to_next_tier' => $amountToNextTier,
                'progress_percent' => round($progressPercent, 1),
                'tier_review_at' => $tierReviewAt?->toDateString(),
                'days_remaining' => $tierReviewAt ? max($tierReviewAt->diffInDays($now), 0) : null,
            ],
        ];
    }

    public function formatTierData(?MembershipTierRule $rule): ?array
    {
        if (!$rule) {
            return null;
        }

        $badgeImageUrl = $rule->badge_image_path
            ? Storage::disk('public')->url($rule->badge_image_path)
            : null;

        return [
            'code' => $rule->tier,
            'name' => $rule->display_name ?? ucfirst($rule->tier),
            'multiplier' => (float) $rule->multiplier,
            'product_discount_percent' => (float) $rule->product_discount_percent,
            'min_spend' => (float) $rule->min_spent_last_x_months,
            'badge_image_url' => $badgeImageUrl,
        ];
    }

    protected function clamp(float $value, float $min = 0, float $max = 100): float
    {
        return max(min($value, $max), $min);
    }
}
