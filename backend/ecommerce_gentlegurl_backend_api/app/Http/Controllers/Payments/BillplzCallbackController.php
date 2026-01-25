<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Models\BillplzBill;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Cart;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class BillplzCallbackController extends Controller
{
    public function callback(Request $request)
    {
        $payload = $request->all();
        $billplzPayload = $payload['billplz'] ?? $payload;

        if (!$this->verifySignature($payload)) {
            Log::warning('Billplz callback invalid signature', $payload);
            return response('invalid signature', 400);
        }

        $billId = $billplzPayload['id'] ?? null;
        $referenceOrderNo = $billplzPayload['reference_1'] ?? $billplzPayload['order_no'] ?? null;

        if (!$billId && !$referenceOrderNo) {
            return response('missing bill id', 400);
        }

        $bill = $billId ? BillplzBill::where('billplz_id', $billId)->first() : null;
        $order = $bill?->order;

        if (!$order && $referenceOrderNo) {
            $order = Order::where('order_number', $referenceOrderNo)->first();
        }

        if (!$order) {
            Log::warning('Billplz callback order not found', ['bill_id' => $billId, 'reference' => $referenceOrderNo]);
            return response('order not found', 404);
        }

        if (!$bill && $billId) {
            $bill = new BillplzBill([
                'billplz_id' => $billId,
                'order_id' => $order->id,
            ]);
        }

        if ($bill) {
            $bill->order_id = $order->id;
            $bill->state = $billplzPayload['state'] ?? $bill->state;
            $bill->paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : $bill->paid;
            $bill->amount = isset($billplzPayload['amount']) ? (int) $billplzPayload['amount'] : $bill->amount;
            $bill->paid_at = $billplzPayload['paid_at'] ?? $bill->paid_at;
            $bill->collection_id = $billplzPayload['collection_id'] ?? $bill->collection_id;
            $bill->payload = $payload;
            $bill->save();
        }

        $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;
        $paidAt = $billplzPayload['paid_at'] ?? null;

        if ($paid && $order->payment_status !== 'paid') {
            $order->payment_status = 'paid';
            if ($order->status === 'pending') {
                $order->status = 'paid';
            }
            $order->paid_at = $paidAt ? Carbon::parse($paidAt) : now();
            $order->payment_reference = $order->payment_reference ?: $billId;
            $order->payment_provider = $order->payment_provider ?: 'billplz';
            $order->save();

            $this->clearOrderCart($order);
        }

        return response('OK', 200);
    }

    public function redirect(Request $request)
    {
        $billId = $request->query('billplz[id]') ?? $request->query('bill_id') ?? $request->query('id');

        if ($billId) {
            $bill = BillplzBill::where('billplz_id', $billId)->first();
            if ($bill) {
                $order = $bill->order;
                $billplzPayload = $request->query('billplz') ?? [];

                if (!empty($billplzPayload) && $this->verifySignature(['billplz' => $billplzPayload])) {
                    $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;

                    if ($paid) {
                        $bill->paid = true;
                        $bill->paid_at = $billplzPayload['paid_at'] ?? $bill->paid_at;
                        $bill->payload = array_merge($bill->payload ?? [], ['redirect' => $billplzPayload]);
                        $bill->save();

                        if ($order->payment_status !== 'paid') {
                            $order->payment_status = 'paid';
                            if ($order->status === 'pending') {
                                $order->status = 'paid';
                            }
                            $order->paid_at = $billplzPayload['paid_at'] ?? $order->paid_at ?? now();
                            $order->payment_reference = $order->payment_reference ?: $billId;
                            $order->payment_provider = $order->payment_provider ?: 'billplz';
                            $order->save();

                            $this->clearOrderCart($order);
                        }
                    }
                }

                $query = http_build_query([
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'provider' => 'billplz',
                    'payment_method' => $order->payment_method,
                ]);

                $frontendUrl = rtrim((string) config('services.billplz.frontend_url', ''), '/');
                if ($frontendUrl) {
                    return redirect()->away($frontendUrl . '/payment-result?' . $query);
                }

                return response()->json([
                    'order_id' => $order->id,
                    'order_no' => $order->order_number,
                    'payment_status' => $order->payment_status,
                    'status' => $order->status,
                ]);
            }
        }

        return response()->json([
            'message' => 'Unknown payment status',
        ]);
    }

    protected function verifySignature(array $payload): bool
    {
        $xSignatureKey = config('services.billplz.x_signature');

        $billplzPayload = $payload['billplz'] ?? $payload;
        $signature = $billplzPayload['x_signature'] ?? $payload['x_signature'] ?? null;

        if (!$xSignatureKey || !$signature) {
            return false;
        }

        $components = [
            'billplzid' => $this->normalizeSignatureValue($billplzPayload['id'] ?? null),
            'billplzpaid_at' => $this->normalizeSignatureValue($billplzPayload['paid_at'] ?? null),
            'billplzpaid' => $this->normalizeSignatureValue($billplzPayload['paid'] ?? null),
            'billplztransaction_id' => $this->normalizeSignatureValue($billplzPayload['transaction_id'] ?? null),
            'billplzamount' => $this->normalizeSignatureValue($billplzPayload['amount'] ?? null),
            'billplzcollection_id' => $this->normalizeSignatureValue($billplzPayload['collection_id'] ?? null),
            'billplzreference_1' => $this->normalizeSignatureValue($billplzPayload['reference_1'] ?? null),
        ];

        $concatenated = collect($components)
            ->filter(fn($value) => $value !== null && $value !== '')
            ->map(fn($value, $key) => $key . $value)
            ->implode('');

        if ($concatenated) {
            $expected = hash_hmac('sha256', $concatenated, $xSignatureKey);
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        $withPipes = collect($components)
            ->filter(fn($value) => $value !== null && $value !== '')
            ->map(fn($value, $key) => $key . $value)
            ->implode('|');

        if ($withPipes) {
            $expected = hash_hmac('sha256', $withPipes, $xSignatureKey);
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        $flat = $billplzPayload;
        unset($flat['x_signature']);
        ksort($flat);

        $fallbackString = collect($flat)
            ->map(fn($value, $key) => $key . $this->normalizeSignatureValue($value))
            ->implode('|');

        $fallbackExpected = hash_hmac('sha256', $fallbackString, $xSignatureKey);

        return hash_equals($fallbackExpected, $signature);
    }

    protected function normalizeSignatureValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        return (string) $value;
    }

    protected function clearOrderCart(Order $order): void
    {
        if (!$order->customer_id) {
            return;
        }

        $productIds = $order->items()
            ->pluck('product_id')
            ->filter()
            ->unique();

        if ($productIds->isEmpty()) {
            return;
        }

        $carts = Cart::where('customer_id', $order->customer_id)
            ->where('status', 'open')
            ->get();

        foreach ($carts as $cart) {
            $cart->items()
                ->whereIn('product_id', $productIds)
                ->delete();

            if ($cart->items()->count() === 0) {
                $cart->status = 'converted';
            }

            $cart->save();
        }
    }
}
