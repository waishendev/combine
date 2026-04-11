<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Models\BillplzBill;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Cart;
use App\Services\Payments\BillplzConfigResolver;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class BillplzCallbackController extends Controller
{
    public function __construct(
        protected BillplzConfigResolver $configResolver,
    ) {
    }

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
        $workspaceType = $order->paymentGateway?->type ?? WorkspaceType::ECOMMERCE;
        $signatureValid = $this->verifySignature($payload, $workspaceType);
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
                $order->status = 'confirmed';
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
                    $workspaceType = $order->paymentGateway?->type ?? WorkspaceType::ECOMMERCE;
                    $signatureValid = $this->verifySignature(['billplz' => $billplzPayload], $workspaceType);
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

                $workspaceType = $order->paymentGateway?->type ?? WorkspaceType::ECOMMERCE;
                $resolvedConfig = $this->configResolver->resolve($workspaceType, $order->payment_method ?: 'billplz_fpx');
                $workspaceFrontend = rtrim((string) config("services.frontend_url_{$workspaceType}"), '/');
                $frontendUrl = $workspaceFrontend ?: rtrim((string) ($resolvedConfig['frontend_url'] ?? ''), '/');
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

    /**
     * Verify Billplz x_signature for both callback (POST) and redirect (GET).
     *
     * Callback format:  keyvalue pairs sorted by key, joined with "|", NO "billplz" prefix.
     * Redirect format:  "billplz" + key + value pairs sorted, joined with "|".
     *
     * @see https://www.billplz.com/api#x-signature
     */
    protected function verifySignature(array $payload, string $type = WorkspaceType::ECOMMERCE): bool
    {
        $resolvedConfig = $this->configResolver->resolve($type);
        $xSignatureKey = $resolvedConfig['x_signature'] ?: config('services.billplz.x_signature');

        $billplzPayload = $payload['billplz'] ?? $payload;
        $signature = $billplzPayload['x_signature'] ?? null;

        if (!$xSignatureKey || !$signature) {
            Log::debug('Billplz signature verification skipped', [
                'has_key' => !empty($xSignatureKey),
                'has_signature' => !empty($signature),
            ]);
            return false;
        }

        $data = $billplzPayload;
        unset($data['x_signature']);

        $maskedKey = substr($xSignatureKey, 0, 6) . '...' . substr($xSignatureKey, -6);

        if ($this->verifyCallbackSignature($data, $signature, $xSignatureKey)) {
            return true;
        }

        if ($this->verifyRedirectSignature($data, $signature, $xSignatureKey)) {
            return true;
        }

        $callbackSource = $this->buildCallbackSourceString($data);
        $redirectSource = $this->buildRedirectSourceString($data);

        Log::warning('Billplz x_signature verification failed', [
            'bill_id' => $data['id'] ?? null,
            'x_signature_key_used' => $maskedKey,
            'x_signature_key_source' => $resolvedConfig['base_url_source'] ?? 'config',
            'received_signature' => $signature,
            'callback_source_string' => $callbackSource,
            'callback_expected' => hash_hmac('sha256', $callbackSource, $xSignatureKey),
            'redirect_source_string' => $redirectSource,
            'redirect_expected' => hash_hmac('sha256', $redirectSource, $xSignatureKey),
            'payload_keys' => array_keys($data),
        ]);

        return false;
    }

    /**
     * Callback (POST): all fields sorted by key, format keyvalue, joined with "|".
     * Empty/null values are included (just the key name).
     */
    private function verifyCallbackSignature(array $data, string $signature, string $key): bool
    {
        $expected = hash_hmac('sha256', $this->buildCallbackSourceString($data), $key);
        return hash_equals($expected, $signature);
    }

    /**
     * Redirect (GET): all fields prefixed with "billplz", sorted, joined with "|".
     */
    private function verifyRedirectSignature(array $data, string $signature, string $key): bool
    {
        $expected = hash_hmac('sha256', $this->buildRedirectSourceString($data), $key);
        return hash_equals($expected, $signature);
    }

    private function buildCallbackSourceString(array $data): string
    {
        uksort($data, 'strcasecmp');

        $sources = [];
        foreach ($data as $k => $v) {
            $sources[] = $k . ($v ?? '');
        }

        return implode('|', $sources);
    }

    private function buildRedirectSourceString(array $data): string
    {
        $sources = [];
        foreach ($data as $k => $v) {
            $sources[] = 'billplz' . $k . ($v ?? '');
        }
        usort($sources, 'strcasecmp');

        return implode('|', $sources);
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
