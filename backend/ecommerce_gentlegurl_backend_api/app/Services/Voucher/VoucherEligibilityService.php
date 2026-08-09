<?php

namespace App\Services\Voucher;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\Voucher;
use App\Models\Ecommerce\VoucherUsage;
use Carbon\Carbon;

class VoucherEligibilityService
{
    public function validateVoucherForCart(
        string $code,
        ?Customer $customer,
        array $items,
        float $cartSubtotal,
        ?CustomerVoucher $customerVoucher = null,
    ): array {
        $reasons = [];
        $voucher = $customerVoucher?->voucher ?: Voucher::query()
            ->with(['products:id', 'categories:id'])
            ->where('code', $code)
            ->first();

        if (!$voucher) {
            return $this->invalidResult('Voucher not found.', $reasons);
        }

        if ($customerVoucher && $voucher->id !== $customerVoucher->voucher_id) {
            return $this->invalidResult('Voucher not available for this customer.', $reasons, $voucher);
        }

        if ($voucher->is_reward_only && !$customerVoucher) {
            return $this->invalidResult('This voucher must be claimed before use.', $reasons, $voucher);
        }

        if (!$voucher->is_active) {
            return $this->invalidResult('Voucher is not active.', $reasons, $voucher);
        }

        $now = Carbon::now();

        if ($voucher->start_at && $now->lt($voucher->start_at)) {
            return $this->invalidResult('Voucher is not started yet.', $reasons, $voucher);
        }

        if ($voucher->end_at && $now->gt($voucher->end_at)) {
            return $this->invalidResult('Voucher has expired.', $reasons, $voucher);
        }

        $usageLimitTotal = $voucher->usage_limit_total ?? $voucher->max_uses;
        if ($usageLimitTotal !== null) {
            $totalUsed = VoucherUsage::where('voucher_id', $voucher->id)->count();
            if ($totalUsed >= $usageLimitTotal) {
                return $this->invalidResult('Voucher total usage limit reached.', $reasons, $voucher);
            }
        }

        $usageLimitPerCustomer = $voucher->usage_limit_per_customer ?? $voucher->max_uses_per_customer;
        if ($customer && $usageLimitPerCustomer !== null) {
            $customerUsed = VoucherUsage::where('voucher_id', $voucher->id)
                ->where('customer_id', $customer->id)
                ->count();

            if ($customerUsed >= $usageLimitPerCustomer) {
                return $this->invalidResult('Voucher already used by this customer.', $reasons, $voucher);
            }
        }

        if ($customerVoucher) {
            if (!$customer) {
                return $this->invalidResult('Please login to use this voucher.', $reasons, $voucher, $customerVoucher);
            }

            if ($customerVoucher->customer_id !== $customer?->id) {
                return $this->invalidResult('Voucher not available for this customer.', $reasons, $voucher, $customerVoucher);
            }

            $quantityTotal = $customerVoucher->quantity_total ?? 1;
            $quantityUsed = $customerVoucher->quantity_used ?? 0;
            if ($quantityUsed >= $quantityTotal) {
                return $this->invalidResult('Voucher has already been used.', $reasons, $voucher, $customerVoucher);
            }

            if ($customerVoucher->status !== 'active') {
                return $this->invalidResult('Voucher is not active.', $reasons, $voucher, $customerVoucher);
            }

            $startAt = $customerVoucher->start_at ?? $voucher->start_at;
            $endAt = $customerVoucher->end_at ?? $customerVoucher->expires_at ?? $voucher->end_at;
            if ($startAt && $startAt->gt($now)) {
                return $this->invalidResult('Voucher is not started yet.', $reasons, $voucher, $customerVoucher);
            }

            if ($endAt && $endAt->lt($now)) {
                return $this->invalidResult('Voucher has expired.', $reasons, $voucher, $customerVoucher);
            }
        }

        $scopeType = $voucher->scope_type ?? 'all';
        $eligibleSubtotal = 0.0;
        $affectedItems = [];

        if ($scopeType === 'all') {
            foreach ($items as $item) {
                $lineTotal = (float) ($item['line_total'] ?? 0);
                $eligibleSubtotal += $lineTotal;
                if (!empty($item['product_id'])) {
                    $affectedItems[] = (int) $item['product_id'];
                }
            }
        } elseif ($scopeType === 'products') {
            $productIds = $voucher->products->pluck('id')->all();
            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                if ($productId && in_array($productId, $productIds, true)) {
                    $lineTotal = (float) ($item['line_total'] ?? 0);
                    $eligibleSubtotal += $lineTotal;
                    $affectedItems[] = $productId;
                }
            }
        } elseif ($scopeType === 'categories') {
            $categoryIds = $voucher->categories->pluck('id')->all();
            $productIds = collect($items)
                ->pluck('product_id')
                ->filter()
                ->unique()
                ->map(fn($id) => (int) $id)
                ->values()
                ->all();

            $productCategoryMap = [];
            if (!empty($productIds)) {
                $products = Product::query()
                    ->with('categories:id')
                    ->whereIn('id', $productIds)
                    ->get(['id']);

                foreach ($products as $product) {
                    $productCategoryMap[$product->id] = $product->categories->pluck('id')->all();
                }
            }

            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                if (!$productId) {
                    continue;
                }

                $productCategoryIds = $productCategoryMap[$productId] ?? [];
                $matchesCategory = !empty(array_intersect($categoryIds, $productCategoryIds));
                if ($matchesCategory) {
                    $lineTotal = (float) ($item['line_total'] ?? 0);
                    $eligibleSubtotal += $lineTotal;
                    $affectedItems[] = $productId;
                }
            }
        } else {
            $eligibleSubtotal = $cartSubtotal;
        }

        if ($eligibleSubtotal <= 0) {
            return $this->invalidResult('Voucher not applicable to selected items.', $reasons, $voucher, $customerVoucher, $eligibleSubtotal, $affectedItems);
        }

        $minOrderAmount = (float) ($voucher->min_order_amount ?? 0);
        if ($minOrderAmount > 0 && $eligibleSubtotal < $minOrderAmount) {
            $message = sprintf('Minimum spend of RM %.2f is required for eligible items.', $minOrderAmount);
            return $this->invalidResult($message, $reasons, $voucher, $customerVoucher, $eligibleSubtotal, $affectedItems);
        }

        $value = $voucher->value !== null ? (float) $voucher->value : 0.0;
        $discount = 0.0;
        if ($voucher->type === 'fixed') {
            $discount = min($value, $eligibleSubtotal);
        } elseif ($voucher->type === 'percent') {
            $discount = $eligibleSubtotal * ($value / 100);
            if ($voucher->max_discount_amount !== null) {
                $discount = min($discount, (float) $voucher->max_discount_amount);
            }
        }

        if ($discount <= 0) {
            return $this->invalidResult('Voucher discount amount is zero.', $reasons, $voucher, $customerVoucher, $eligibleSubtotal, $affectedItems);
        }

        return [
            'is_valid' => true,
            'message' => null,
            'eligible_subtotal' => round($eligibleSubtotal, 2),
            'discount_amount' => round($discount, 2),
            'affected_items' => array_values(array_unique($affectedItems)),
            'voucher' => [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'type' => $voucher->type,
                'value' => $value,
                'max_discount_amount' => $voucher->max_discount_amount ? (float) $voucher->max_discount_amount : null,
                'scope_type' => $scopeType,
            ],
            'customer_voucher_id' => $customerVoucher?->id,
            'display_scope_text' => $this->displayScopeText($scopeType),
            'reasons' => $reasons,
        ];
    }

    private function invalidResult(
        string $message,
        array $reasons,
        ?Voucher $voucher = null,
        ?CustomerVoucher $customerVoucher = null,
        float $eligibleSubtotal = 0.0,
        array $affectedItems = [],
    ): array {
        $reasons[] = $message;

        return [
            'is_valid' => false,
            'message' => $message,
            'eligible_subtotal' => round($eligibleSubtotal, 2),
            'discount_amount' => 0.0,
            'affected_items' => array_values(array_unique($affectedItems)),
            'voucher' => $voucher ? [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'type' => $voucher->type,
                'value' => $voucher->value !== null ? (float) $voucher->value : 0.0,
                'max_discount_amount' => $voucher->max_discount_amount ? (float) $voucher->max_discount_amount : null,
                'scope_type' => $voucher->scope_type ?? 'all',
            ] : null,
            'customer_voucher_id' => $customerVoucher?->id,
            'display_scope_text' => $voucher ? $this->displayScopeText($voucher->scope_type ?? 'all') : null,
            'reasons' => $reasons,
        ];
    }

    private function displayScopeText(string $scopeType): string
    {
        return match ($scopeType) {
            'products' => 'Applicable to selected products',
            'categories' => 'Applicable to categories',
            default => 'Storewide',
        };
    }
}
