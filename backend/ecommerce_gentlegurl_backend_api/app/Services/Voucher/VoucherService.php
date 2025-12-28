<?php

namespace App\Services\Voucher;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Voucher;
use App\Models\Ecommerce\VoucherUsage;
use App\Models\Ecommerce\CustomerVoucher;
use Carbon\Carbon;

class VoucherService
{
    public function validateAndCalculateDiscount(
        string $code,
        ?Customer $customer,
        float $orderAmount,
        ?CustomerVoucher $customerVoucher = null,
        bool $markCustomerVoucherUsed = false
    ): VoucherResult {
        $voucher = $customerVoucher?->voucher ?: Voucher::where('code', $code)->first();

        if (!$voucher) {
            return VoucherResult::invalid('Voucher not found.');
        }

        if ($customerVoucher && $voucher->id !== $customerVoucher->voucher_id) {
            return VoucherResult::invalid('Voucher not available for this customer.');
        }

        if ($voucher->is_reward_only && !$customerVoucher) {
            return VoucherResult::invalid('This voucher must be claimed before use.');
        }

        if (!$voucher->is_active) {
            return VoucherResult::invalid('Voucher is not active.');
        }

        $now = Carbon::now();

        if ($voucher->start_at && $now->lt($voucher->start_at)) {
            return VoucherResult::invalid('Voucher is not started yet.');
        }

        if ($voucher->end_at && $now->gt($voucher->end_at)) {
            return VoucherResult::invalid('Voucher has expired.');
        }

        $minOrderAmount = $voucher->min_order_amount !== null ? (float) $voucher->min_order_amount : null;
        if ($minOrderAmount && $orderAmount < $minOrderAmount) {
            return VoucherResult::invalid('Order amount is below voucher minimum amount.');
        }

        $usageLimitTotal = $voucher->usage_limit_total ?? $voucher->max_uses;
        if ($usageLimitTotal !== null) {
            $totalUsed = VoucherUsage::where('voucher_id', $voucher->id)->count();
            if ($totalUsed >= $usageLimitTotal) {
                return VoucherResult::invalid('Voucher total usage limit reached.');
            }
        }

        $usageLimitPerCustomer = $voucher->usage_limit_per_customer ?? $voucher->max_uses_per_customer;
        if ($customer && $usageLimitPerCustomer !== null) {
            $customerUsed = VoucherUsage::where('voucher_id', $voucher->id)
                ->where('customer_id', $customer->id)
                ->count();

            if ($customerUsed >= $usageLimitPerCustomer) {
                return VoucherResult::invalid('Voucher already used by this customer.');
            }
        }

        if ($customerVoucher) {
            if (!$customer) {
                return VoucherResult::invalid('Please login to use this voucher.');
            }

            if ($customerVoucher->customer_id !== $customer?->id) {
                return VoucherResult::invalid('Voucher not available for this customer.');
            }

            if ($customerVoucher->status === 'used') {
                return VoucherResult::invalid('Voucher has already been used.');
            }

            if ($customerVoucher->status !== 'active') {
                return VoucherResult::invalid('Voucher is not active.');
            }

            if ($customerVoucher->expires_at && $customerVoucher->expires_at->lt($now)) {
                return VoucherResult::invalid('Voucher has expired.');
            }
        }

        $value = $voucher->value !== null ? (float) $voucher->value : 0.0;
        $discount = 0.0;
        if ($voucher->type === 'fixed') {
            $discount = min($value, $orderAmount);
        } elseif ($voucher->type === 'percent') {
            $discount = $orderAmount * ($value / 100);
            if ($voucher->max_discount_amount !== null) {
                $discount = min($discount, (float) $voucher->max_discount_amount);
            }
        }

        if ($discount <= 0) {
            return VoucherResult::invalid('Voucher discount amount is zero.');
        }

        if ($customerVoucher && $markCustomerVoucherUsed && $customerVoucher->status === 'active') {
            $customerVoucher->status = 'used';
            $customerVoucher->used_at = Carbon::now();
            $customerVoucher->save();
        }

        return VoucherResult::valid($discount, [
            'id' => $voucher->id,
            'code' => $voucher->code,
            'type' => $voucher->type,
            'value' => $value,
            'max_discount_amount' => $voucher->max_discount_amount ? (float) $voucher->max_discount_amount : null,
        ], $customerVoucher?->id);
    }

    public function recordUsage(int $voucherId, ?int $customerId, int $orderId, ?int $customerVoucherId = null, ?float $discountAmount = null): void
    {
        $usage = VoucherUsage::create([
            'voucher_id' => $voucherId,
            'customer_id' => $customerId,
            'order_id' => $orderId,
            'customer_voucher_id' => $customerVoucherId,
            'discount_amount' => $discountAmount,
            'used_at' => Carbon::now(),
        ]);

        if ($customerVoucherId) {
            $customerVoucher = CustomerVoucher::find($customerVoucherId);
            if ($customerVoucher && $customerVoucher->status === 'active') {
                $customerVoucher->status = 'used';
                $customerVoucher->used_at = $usage->used_at;
                $customerVoucher->save();
            }
        }
    }
}
