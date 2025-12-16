<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Models\BillplzBill;
use App\Models\Ecommerce\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BillplzCallbackController extends Controller
{
    public function callback(Request $request)
    {
        $payload = $request->all();

        if (!$this->verifySignature($payload)) {
            Log::warning('Billplz callback invalid signature', $payload);
            return response('invalid signature', 400);
        }

        $billId = $payload['id'] ?? null;

        if (!$billId) {
            return response('missing bill id', 400);
        }

        $bill = BillplzBill::where('billplz_id', $billId)->first();

        if (!$bill) {
            Log::warning('Billplz callback bill not found', $payload);
            return response('bill not found', 404);
        }

        $bill->state = $payload['state'] ?? $bill->state;
        $bill->paid = isset($payload['paid']) ? filter_var($payload['paid'], FILTER_VALIDATE_BOOLEAN) : $bill->paid;
        $bill->amount = isset($payload['amount']) ? (int) $payload['amount'] : $bill->amount;
        $bill->paid_at = $payload['paid_at'] ?? $bill->paid_at;
        $bill->payload = $payload;
        $bill->save();

        /** @var Order $order */
        $order = $bill->order;

        if ($bill->paid && $order->payment_status !== 'paid') {
            $order->payment_status = 'paid';
            if ($order->status === 'pending') {
                $order->status = 'paid';
            }
            $order->paid_at = now();
            $order->save();
        }

        return response('OK', 200);
    }

    public function redirect(Request $request)
    {
        $billId = $request->query('billplz[id]') ?? $request->query('bill_id');

        if ($billId) {
            $bill = BillplzBill::where('billplz_id', $billId)->first();
            if ($bill) {
                return response()->json([
                    'order_id' => $bill->order_id,
                    'order_no' => $bill->order->order_number,
                    'payment_status' => $bill->order->payment_status,
                    'status' => $bill->order->status,
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

        if (!$xSignatureKey || !isset($payload['x_signature'])) {
            return false;
        }

        $signature = $payload['x_signature'];
        unset($payload['x_signature']);

        ksort($payload);

        $pairs = [];
        foreach ($payload as $key => $value) {
            $pairs[] = $key . $value;
        }

        $signedString = implode('|', $pairs);

        $expected = hash_hmac('sha256', $signedString, $xSignatureKey);

        return hash_equals($expected, $signature);
    }
}
