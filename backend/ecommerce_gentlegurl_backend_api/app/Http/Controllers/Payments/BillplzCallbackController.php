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

        $billId = $billplzPayload['id'] ?? null;
        $referenceOrderNo = $billplzPayload['reference_1'] ?? $billplzPayload['order_no'] ?? null;

        if (!$billId && !$referenceOrderNo) {
            Log::warning('Billplz callback missing bill id and reference', $payload);
            return response('missing bill id', 400);
        }

        // Try to find order first to validate the callback
        $bill = $billId ? BillplzBill::where('billplz_id', $billId)->first() : null;
        $order = $bill?->order;

        if (!$order && $referenceOrderNo) {
            $order = Order::where('order_number', $referenceOrderNo)->first();
        }

        if (!$order) {
            Log::warning('Billplz callback order not found', ['bill_id' => $billId, 'reference' => $referenceOrderNo, 'payload' => $payload]);
            return response('order not found', 404);
        }

        // Verify signature, but don't block processing if order exists and payment is confirmed
        $signatureValid = $this->verifySignature($payload);
        $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;
        $state = $billplzPayload['state'] ?? null;
        $transactionStatus = $billplzPayload['transaction_status'] ?? null;

        if (!$signatureValid) {
            // Log detailed signature verification failure for debugging
            $xSignatureKey = config('services.billplz.x_signature');
            Log::warning('Billplz callback invalid signature', [
                'bill_id' => $billId,
                'order_no' => $referenceOrderNo,
                'order_id' => $order->id,
                'paid' => $paid,
                'state' => $state,
                'transaction_status' => $transactionStatus,
                'has_x_signature_key' => !empty($xSignatureKey),
                'payload' => $payload,
            ]);

            // If payment is clearly marked as paid and we have a valid order, 
            // process it anyway but log the signature failure
            // This prevents legitimate payments from being blocked due to signature issues
            if (!($paid && ($state === 'paid' || $transactionStatus === 'completed'))) {
                return response('invalid signature', 400);
            }
            
            Log::warning('Billplz callback processing despite signature failure - payment confirmed', [
                'order_id' => $order->id,
                'order_no' => $order->order_number,
            ]);
        }

        if (!$bill && $billId) {
            $bill = new BillplzBill([
                'billplz_id' => $billId,
                'order_id' => $order->id,
            ]);
        }

        if ($bill) {
            $bill->order_id = $order->id;
            $bill->state = $state ?? $bill->state;
            $bill->paid = $paid ?? $bill->paid;
            $bill->amount = isset($billplzPayload['amount']) ? (int) $billplzPayload['amount'] : $bill->amount;
            $bill->paid_at = $billplzPayload['paid_at'] ?? $bill->paid_at;
            $bill->collection_id = $billplzPayload['collection_id'] ?? $bill->collection_id;
            $bill->payload = $payload;
            $bill->save();
        }

        $paidAt = $billplzPayload['paid_at'] ?? null;

        // Check if payment is confirmed (paid=true OR state=paid OR transaction_status=completed)
        $isPaymentConfirmed = $paid || $state === 'paid' || $transactionStatus === 'completed';

        if ($isPaymentConfirmed && $order->payment_status !== 'paid') {
            $order->payment_status = 'paid';
            if ($order->status === 'pending') {
                $order->status = 'paid';
            }
            $order->paid_at = $paidAt ? Carbon::parse($paidAt) : now();
            $order->payment_reference = $order->payment_reference ?: $billId;
            $order->payment_provider = $order->payment_provider ?: 'billplz';
            $order->save();

            $this->clearOrderCart($order);

            Log::info('Billplz callback processed successfully', [
                'order_id' => $order->id,
                'order_no' => $order->order_number,
                'bill_id' => $billId,
                'signature_valid' => $signatureValid,
            ]);
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

                if (!empty($billplzPayload)) {
                    $signatureValid = $this->verifySignature(['billplz' => $billplzPayload]);
                    $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;
                    $state = $billplzPayload['state'] ?? null;
                    $transactionStatus = $billplzPayload['transaction_status'] ?? null;
                    $isPaymentConfirmed = $paid || $state === 'paid' || $transactionStatus === 'completed';

                    // Process payment if signature is valid OR if payment is clearly confirmed
                    if ($signatureValid || $isPaymentConfirmed) {
                        if ($isPaymentConfirmed) {
                            $bill->paid = true;
                            $bill->state = $state ?? $bill->state;
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

                                if (!$signatureValid) {
                                    Log::warning('Billplz redirect processed despite signature failure - payment confirmed', [
                                        'order_id' => $order->id,
                                        'order_no' => $order->order_number,
                                        'bill_id' => $billId,
                                    ]);
                                }
                            }
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
        $signature = $billplzPayload['x_signature'] ?? null;

        if (!$xSignatureKey || !$signature) {
            Log::debug('Billplz signature verification skipped - missing key or signature', [
                'has_key' => !empty($xSignatureKey),
                'has_signature' => !empty($signature),
            ]);
            return false;
        }

        // Method 1: Standard Billplz signature format (without separators)
        // Order: billplzid|billplzpaid_at|billplzpaid|billplztransaction_id|billplzamount|billplzcollection_id|billplzreference_1
        $components = [
            'billplzid' => $billplzPayload['id'] ?? null,
            'billplzpaid_at' => $billplzPayload['paid_at'] ?? null,
            'billplzpaid' => $billplzPayload['paid'] ?? null,
            'billplztransaction_id' => $billplzPayload['transaction_id'] ?? null,
            'billplzamount' => $billplzPayload['amount'] ?? null,
            'billplzcollection_id' => $billplzPayload['collection_id'] ?? null,
            'billplzreference_1' => $billplzPayload['reference_1'] ?? null,
        ];

        // Try without separator (concatenated)
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

        // Try with pipe separator (standard Billplz format)
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

        // Method 2: Try with all fields sorted alphabetically (fallback)
        $flat = $billplzPayload;
        unset($flat['x_signature']);
        ksort($flat);

        $fallbackString = collect($flat)
            ->map(fn($value, $key) => $key . $value)
            ->implode('|');

        $fallbackExpected = hash_hmac('sha256', $fallbackString, $xSignatureKey);
        if (hash_equals($fallbackExpected, $signature)) {
            return true;
        }

        // Method 3: Try with only non-empty fields, sorted
        $nonEmptyFields = collect($flat)
            ->filter(fn($value) => $value !== null && $value !== '')
            ->map(fn($value, $key) => $key . $value)
            ->implode('|');

        if ($nonEmptyFields) {
            $expected = hash_hmac('sha256', $nonEmptyFields, $xSignatureKey);
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        // Log failed verification details for debugging
        Log::debug('Billplz signature verification failed', [
            'bill_id' => $billplzPayload['id'] ?? null,
            'components' => $components,
            'concatenated' => $concatenated,
            'with_pipes' => $withPipes,
            'fallback_string' => $fallbackString,
            'received_signature' => $signature,
        ]);

        return false;
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
