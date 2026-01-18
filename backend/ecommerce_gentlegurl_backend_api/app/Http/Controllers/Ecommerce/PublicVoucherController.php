<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\Voucher;
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
            ->orderByRaw('COALESCE(assigned_at, claimed_at) DESC');

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
            $endAt = $voucher->end_at ?? $voucher->expires_at ?? $voucher->voucher?->end_at;
            if ($voucher->status === 'active' && $endAt && $endAt->lt($now)) {
                $voucher->status = 'expired';
                $voucher->save();
            }
        });

        $data = $vouchers->map(function (CustomerVoucher $customerVoucher) {
            return [
                'id' => $customerVoucher->id,
                'status' => $customerVoucher->status,
                'assigned_at' => $customerVoucher->assigned_at,
                'claimed_at' => $customerVoucher->claimed_at,
                'used_at' => $customerVoucher->used_at,
                'expires_at' => $customerVoucher->end_at ?? $customerVoucher->expires_at,
                'quantity_total' => $customerVoucher->quantity_total,
                'quantity_used' => $customerVoucher->quantity_used,
                'note' => $customerVoucher->note,
                'voucher' => $customerVoucher->voucher ? [
                    'id' => $customerVoucher->voucher->id,
                    'code' => $customerVoucher->voucher->code,
                    'type' => $customerVoucher->voucher->type,
                    'value' => $customerVoucher->voucher->value,
                    'min_order_amount' => $customerVoucher->voucher->min_order_amount,
                    'max_discount_amount' => $customerVoucher->voucher->max_discount_amount,
                    'start_at' => $customerVoucher->voucher->start_at,
                    'end_at' => $customerVoucher->voucher->end_at,
                    'scope_type' => $customerVoucher->voucher->scope_type ?? 'all',
                ] : null,
            ];
        });

        return $this->respond($data);
    }

    public function show(Voucher $voucher)
    {
        $voucher->load([
            'products:id,name,sku',
            'categories:id,name',
        ]);

        return $this->respond([
            'id' => $voucher->id,
            'code' => $voucher->code,
            'type' => $voucher->type,
            'value' => $voucher->value,
            'min_order_amount' => $voucher->min_order_amount,
            'max_discount_amount' => $voucher->max_discount_amount,
            'start_at' => $voucher->start_at,
            'end_at' => $voucher->end_at,
            'scope_type' => $voucher->scope_type ?? 'all',
            'products' => $voucher->products->map(fn($product) => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
            ])->values(),
            'categories' => $voucher->categories->map(fn($category) => [
                'id' => $category->id,
                'name' => $category->name,
            ])->values(),
        ]);
    }
}
