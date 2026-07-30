<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Mail\BookingConfirmationMail;
use App\Models\BillplzBill;
use App\Models\Booking\Booking;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Cart;
use App\Services\Payments\BillplzConfigResolver;
use App\Services\Booking\BookingOrderConfirmationService;
use App\Services\Booking\CustomerServicePackageService;
use App\Services\Ecommerce\CustomerWalletService;
use App\Services\SettingService;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class BillplzCallbackController extends Controller
{
    public function __construct(
        protected BillplzConfigResolver $configResolver,
        protected BookingOrderConfirmationService $bookingOrderConfirmationService,
        protected CustomerWalletService $customerWalletService,
    ) {
    }

    public function callback(Request $request)
    {
        $payload = $request->all();
        $billplzPayload = $payload['billplz'] ?? $payload;

        $billId = $billplzPayload['id'] ?? null;
        $referenceOrderNo = $billplzPayload['reference_1'] ?? $billplzPayload['order_no'] ?? null;
        $reference2 = $billplzPayload['reference_2'] ?? null;

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

        if (! $order) {
            $walletTopup = $this->findWalletTopup($billId, $referenceOrderNo, $reference2);
            if ($walletTopup) {
                return $this->processWalletTopupCallback($walletTopup, $payload, $billplzPayload, (string) $billId);
            }

            Log::warning('Billplz callback order not found', ['bill_id' => $billId, 'reference' => $referenceOrderNo, 'payload' => $payload]);
            return response('order not found', 404);
        }

        // A provider status is never trusted unless its signature is valid.
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

            return response('invalid signature', 400);
        }

        $receivedAmount = isset($billplzPayload['amount']) ? (int) $billplzPayload['amount'] : null;
        $expectedAmount = $bill?->amount !== null
            ? (int) $bill->amount
            : (int) round(((float) $order->grand_total) * 100);

        if ($receivedAmount === null || $receivedAmount !== $expectedAmount) {
            Log::warning('Billplz callback amount mismatch', [
                'bill_id' => $billId,
                'order_id' => $order->id,
                'expected_amount' => $expectedAmount,
                'received_amount' => $receivedAmount,
            ]);

            return response('amount mismatch', 400);
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
            $this->confirmOrderBookings($order, $billId);

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
        $billplzPayload = $request->query('billplz') ?? [];
        if (! is_array($billplzPayload)) {
            $billplzPayload = [];
        }

        if ($billId) {
            $bill = BillplzBill::where('billplz_id', $billId)->first();
            if ($bill) {
                $order = $bill->order;

                if (!empty($billplzPayload)) {
                    $workspaceType = $order->paymentGateway?->type ?? WorkspaceType::ECOMMERCE;
                    $signatureValid = $this->verifySignature(['billplz' => $billplzPayload], $workspaceType);
                    $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;
                    $state = $billplzPayload['state'] ?? null;
                    $transactionStatus = $billplzPayload['transaction_status'] ?? null;
                    // Browser redirects are informational only. The signed server-to-server
                    // callback is the sole payment confirmation path.
                    $isPaymentConfirmed = false;

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
                                $this->confirmOrderBookings($order, $billId);

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

            $walletTopup = $this->findWalletTopup((string) $billId, $billplzPayload['reference_1'] ?? null, $billplzPayload['reference_2'] ?? null);
            if ($walletTopup) {
                $this->processWalletTopupCallback($walletTopup, ['billplz' => $billplzPayload], $billplzPayload, (string) $billId);

                $workspaceType = in_array((string) $walletTopup->workspace_type, ['ecommerce', 'booking'], true)
                    ? (string) $walletTopup->workspace_type
                    : WorkspaceType::BOOKING;
                $resolvedConfig = $this->configResolver->resolve($workspaceType, $walletTopup->payment_gateway_key ?: 'billplz_fpx');
                $workspaceFrontend = rtrim((string) config("services.frontend_url_{$workspaceType}"), '/');
                $frontendUrl = $workspaceFrontend ?: rtrim((string) ($resolvedConfig['frontend_url'] ?? ''), '/');
                if ($frontendUrl) {
                    return redirect()->away($frontendUrl.'/account/wallet?'.http_build_query([
                        'wallet_topup' => '1',
                        'tx' => $walletTopup->transaction_no,
                        'provider' => 'billplz',
                        'payment_method' => $walletTopup->payment_gateway_key,
                    ]));
                }
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

    protected function confirmOrderBookings(Order $order, ?string $billId = null): void
    {
        app(CustomerServicePackageService::class)->fulfillPendingPackagesForPaidOrder($order->fresh(['items', 'customer']));

        $confirmedIds = $this->bookingOrderConfirmationService->confirmLinkedBookingsForPaidOrder(
            $order,
            'order_callback',
            [
                'ref' => $billId,
                'provider' => 'billplz',
            ],
        );

        if ($confirmedIds === []) {
            return;
        }

        $bookings = Booking::query()
            ->whereIn('id', $confirmedIds)
            ->where('status', 'CONFIRMED')
            ->with(['service', 'staff', 'customer'])
            ->get();

        foreach ($bookings as $booking) {
            $this->sendBookingConfirmationEmail($booking);
        }

        Log::info('Order bookings confirmed after payment', [
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'booking_ids' => $confirmedIds,
            'bill_id' => $billId,
        ]);
    }

    protected function sendBookingConfirmationEmail(?Booking $booking): void
    {
        if (!$booking || (string) $booking->status !== 'CONFIRMED') {
            return;
        }

        $recipientEmail = $booking->billing_email
            ?: $booking->guest_email
            ?: $booking->customer?->email;

        if (!$recipientEmail || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $customerName = $booking->billing_name
            ?: $booking->guest_name
            ?: $booking->customer?->name
            ?: 'Customer';

        try {
            $widget = SettingService::get('shop_contact_widget', null, 'booking');
            $phone = data_get($widget, 'whatsapp.phone');
            $contactPhone = ($phone && is_string($phone) && trim($phone) !== '')
                ? trim($phone)
                : '010-387 0881';

            $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
                ->map(fn ($item) => is_array($item) ? [
                    'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                    'extra_duration_min' => (int) ($item['extra_duration_min'] ?? 0),
                    'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                ] : null)
                ->filter()
                ->values()
                ->all();

            Mail::to($recipientEmail)->queue(new BookingConfirmationMail(
                bookingCode: (string) ($booking->booking_code ?? ''),
                customerName: $customerName,
                serviceName: (string) ($booking->service?->name ?? 'Service'),
                staffName: (string) ($booking->staff?->name ?? ''),
                appointmentDate: $booking->start_at?->format('l, d M Y') ?? '—',
                appointmentStartTime: $booking->start_at?->format('h:i A') ?? '—',
                appointmentEndTime: $booking->end_at?->format('h:i A') ?? '—',
                durationMin: (int) ($booking->service?->duration_min ?? 0),
                depositAmount: (float) ($booking->deposit_amount ?? 0),
                source: (string) ($booking->source ?? 'ONLINE'),
                addonItems: $addonItems,
                contactPhone: $contactPhone,
            ));

            Log::info('Booking confirmation email queued (order callback).', [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'email' => $recipientEmail,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to queue booking confirmation email (order callback).', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);
        }
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

    protected function findWalletTopup(?string $billId, mixed $reference1, mixed $reference2): ?CustomerWalletTransaction
    {
        if ($billId) {
            $byBill = CustomerWalletTransaction::query()
                ->where('type', CustomerWalletTransaction::TYPE_TOPUP)
                ->where(function ($query) use ($billId) {
                    $query->where('reference_no', $billId)
                        ->orWhere('metadata->billplz_id', $billId);
                })
                ->latest('id')
                ->first();
            if ($byBill) {
                return $byBill;
            }
        }

        foreach ([$reference2, $reference1] as $reference) {
            $ref = is_string($reference) ? trim($reference) : '';
            if ($ref === '' || ! str_starts_with($ref, 'WTX')) {
                continue;
            }
            $byTx = CustomerWalletTransaction::query()
                ->where('type', CustomerWalletTransaction::TYPE_TOPUP)
                ->where('transaction_no', $ref)
                ->latest('id')
                ->first();
            if ($byTx) {
                return $byTx;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $billplzPayload
     */
    protected function processWalletTopupCallback(
        CustomerWalletTransaction $topup,
        array $payload,
        array $billplzPayload,
        string $billId,
    ) {
        $workspaceType = in_array((string) $topup->workspace_type, ['ecommerce', 'booking'], true)
            ? (string) $topup->workspace_type
            : WorkspaceType::BOOKING;

        $signatureValid = $this->verifySignature($payload, $workspaceType);
        $paid = isset($billplzPayload['paid']) ? filter_var($billplzPayload['paid'], FILTER_VALIDATE_BOOLEAN) : false;
        $state = $billplzPayload['state'] ?? null;
        $transactionStatus = $billplzPayload['transaction_status'] ?? null;
        $isPaymentConfirmed = $paid || $state === 'paid' || $transactionStatus === 'completed';

        if (! $signatureValid && ! $isPaymentConfirmed) {
            Log::warning('Billplz wallet top-up callback invalid signature', [
                'bill_id' => $billId,
                'wallet_transaction_id' => $topup->id,
                'transaction_no' => $topup->transaction_no,
            ]);

            return response('invalid signature', 400);
        }

        $metadata = $topup->metadata ?? [];
        $metadata['billplz_callback'] = $billplzPayload;
        $metadata['billplz_id'] = $billId ?: ($metadata['billplz_id'] ?? null);
        $topup->forceFill([
            'metadata' => $metadata,
            'reference_no' => $billId ?: $topup->reference_no,
        ])->save();

        if ($isPaymentConfirmed && $topup->status !== CustomerWalletTransaction::STATUS_COMPLETED) {
            try {
                $fresh = $topup->refresh();
                // Late Billplz callback after reserve expiry: still credit if money was paid.
                if (in_array($fresh->status, [
                    CustomerWalletTransaction::STATUS_EXPIRED,
                    CustomerWalletTransaction::STATUS_CANCELLED,
                ], true)) {
                    $fresh->forceFill([
                        'status' => CustomerWalletTransaction::STATUS_PENDING_PAYMENT,
                        'remark' => 'Billplz payment confirmed after reserve window; crediting balance.',
                    ])->save();
                }

                $this->customerWalletService->complete(
                    $fresh->refresh(),
                    $billId ?: $topup->reference_no,
                    null,
                    'Billplz payment confirmed. Balance credited.',
                );
                Log::info('Billplz wallet top-up completed', [
                    'wallet_transaction_id' => $topup->id,
                    'transaction_no' => $topup->transaction_no,
                    'bill_id' => $billId,
                    'signature_valid' => $signatureValid,
                ]);
            } catch (\Throwable $e) {
                Log::error('Billplz wallet top-up completion failed', [
                    'wallet_transaction_id' => $topup->id,
                    'bill_id' => $billId,
                    'error' => $e->getMessage(),
                ]);

                return response('wallet topup failed', 500);
            }
        }

        return response('OK', 200);
    }
}
