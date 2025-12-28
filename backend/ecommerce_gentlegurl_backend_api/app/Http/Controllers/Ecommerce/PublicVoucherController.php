<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\CustomerVoucher;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PublicVoucherController extends Controller
{
    use ResolvesCurrentCustomer;

    public function index(Request $request)
    {
        $customer = $this->requireCustomer();
        $status = $request->string('status')->toString();
        $now = Carbon::now();

        $query = CustomerVoucher::with('voucher')
            ->where('customer_id', $customer->id)
            ->orderByDesc('claimed_at');

        $vouchers = $query
            ->when($status, fn($q) => $q->where('status', $status))
            // ->when(
            //     $request->filled('is_reward_only'),
            //     fn($q) => $q->whereHas(
            //         'voucher',
            //         fn($voucherQuery) => $voucherQuery->where('is_reward_only', $request->boolean('is_reward_only')),
            //     ),
            // ) 
            ->get();

        $vouchers->each(function (CustomerVoucher $voucher) use ($now) {
            if ($voucher->status === 'active' && $voucher->expires_at && $voucher->expires_at->lt($now)) {
                $voucher->status = 'expired';
                $voucher->save();
            }
        });

        $data = $vouchers->map(function (CustomerVoucher $customerVoucher) {
            return [
                'id' => $customerVoucher->id,
                'status' => $customerVoucher->status,
                'claimed_at' => $customerVoucher->claimed_at,
                'used_at' => $customerVoucher->used_at,
                'expires_at' => $customerVoucher->expires_at,
                'voucher' => $customerVoucher->voucher ? [
                    'id' => $customerVoucher->voucher->id,
                    'code' => $customerVoucher->voucher->code,
                    'type' => $customerVoucher->voucher->type,
                    'value' => $customerVoucher->voucher->value,
                    'min_order_amount' => $customerVoucher->voucher->min_order_amount,
                    'max_discount_amount' => $customerVoucher->voucher->max_discount_amount,
                    'start_at' => $customerVoucher->voucher->start_at,
                    'end_at' => $customerVoucher->voucher->end_at,
                ] : null,
            ];
        });

        return $this->respond($data);
    }
}
