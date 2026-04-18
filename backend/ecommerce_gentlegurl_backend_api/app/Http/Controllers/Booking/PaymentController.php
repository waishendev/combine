<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\BillplzPaymentGatewayOption;
use App\Models\BankAccount;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\PaymentGateway;
use App\Services\Booking\BookingConfirmationEmailService;
use App\Services\Payments\BillplzConfigResolver;
use App\Support\BillplzBaseUrl;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    public function __construct(
        protected BillplzConfigResolver $configResolver,
        protected BookingConfirmationEmailService $bookingConfirmationEmailService,
    ) {
    }

    public function pay(Request $request, int $id)
    {
        $type = WorkspaceType::fromRequest($request, WorkspaceType::BOOKING);
        $validated = $request->validate([
            'payment_method' => ['nullable', 'string', 'in:manual_transfer,billplz_fpx,billplz_card,billplz_online_banking,billplz_credit_card'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'billplz_gateway_option_id' => ['nullable', 'integer', 'exists:billplz_payment_gateway_options,id'],
        ]);

        $booking = Booking::with('customer')->findOrFail($id);
        $this->authorizeBooking($request, $booking);

        if (! in_array($booking->status, ['HOLD', 'CONFIRMED'], true)) {
            return $this->respondError('Only HOLD/CONFIRMED booking can be paid.', 422);
        }

        $paymentMethod = $this->normalizeRequestedPaymentMethod((string) ($validated['payment_method'] ?? 'manual_transfer'));
        $selectedGatewayOption = $this->resolveBillplzGatewayOption($validated, $type, $paymentMethod);
        if ($paymentMethod === 'billplz_online_banking' && ! $selectedGatewayOption && $this->hasActiveBillplzOptions($type, 'online_banking')) {
            return $this->respondError('Selected online banking option is not available.', 422);
        }
        if ($paymentMethod === 'billplz_credit_card' && ! $selectedGatewayOption && $this->hasActiveBillplzOptions($type, 'credit_card')) {
            return $this->respondError('Credit card payment is not available.', 422);
        }
        if (str_starts_with($paymentMethod, 'billplz_') && ! $selectedGatewayOption) {
            Log::warning('Booking pay fallback to generic Billplz flow due to missing/invalid gateway option.', [
                'booking_id' => $booking->id,
                'payment_method' => $paymentMethod,
                'billplz_gateway_option_id' => data_get($validated, 'billplz_gateway_option_id'),
                'type' => $type,
            ]);
        }

        if ($paymentMethod === 'manual_transfer') {
            $bankAccountId = $validated['bank_account_id'] ?? null;
            if (! $bankAccountId) {
                return $this->respondError('bank_account_id is required for manual transfer.', 422);
            }

            $bankAccount = BankAccount::query()
                ->where('type', $type)
                ->where('is_active', true)
                ->find($bankAccountId);

            if (! $bankAccount) {
                return $this->respondError('Selected bank account is not available.', 422);
            }

            $payment = BookingPayment::create([
                'booking_id' => $booking->id,
                'provider' => 'MANUAL_TRANSFER',
                'amount' => $booking->deposit_amount,
                'status' => 'PENDING',
                'ref' => 'BKG-MANUAL-' . $booking->id . '-' . now()->timestamp,
                'raw_response' => [
                    'type' => $type,
                    'payment_method' => $paymentMethod,
                    'bank_account_id' => $bankAccount->id,
                    'bank_account' => $this->mapBankAccount($bankAccount),
                    'payment_status' => 'pending_manual_review',
                ],
            ]);

            return $this->respond([
                'order_id' => $booking->id,
                'order_no' => $booking->booking_code,
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'status' => $payment->status,
                'provider' => $payment->provider,
                'payment_method' => $paymentMethod,
                'payment_result_url' => '/payment-result?' . http_build_query([
                    'order_id' => $booking->id,
                    'order_no' => $booking->booking_code,
                    'payment_method' => $paymentMethod,
                    'provider' => 'manual',
                ]),
                'manual_bank_account' => $payment->raw_response['bank_account'] ?? null,
            ]);
        }

        $gatewayKey = $paymentMethod === 'billplz_credit_card' ? 'billplz_card' : 'billplz_fpx';
        $gateway = PaymentGateway::query()
            ->where('type', $type)
            ->where('key', $gatewayKey)
            ->where('is_active', true)
            ->first();

        if (! $gateway) {
            return $this->respondError('Selected payment gateway is not available.', 422);
        }

        $billplz = $this->createBillplzBill($booking, $type, $paymentMethod, $gateway->config ?? [], $selectedGatewayOption);

        $payment = BookingPayment::create([
            'booking_id' => $booking->id,
            'provider' => strtoupper($paymentMethod),
            'amount' => $booking->deposit_amount,
            'status' => 'PENDING',
            'ref' => (string) (data_get($billplz, 'id') ?: ('BKG-' . $booking->id . '-' . now()->timestamp)),
            'raw_response' => [
                'type' => $type,
                'payment_method' => $paymentMethod,
                'selected_gateway_code' => $selectedGatewayOption?->code,
                'selected_gateway_name' => $selectedGatewayOption?->name,
                'billplz' => $billplz,
                'payment_url' => data_get($billplz, 'url'),
            ],
        ]);

        return $this->respond([
            'order_id' => $booking->id,
            'order_no' => $booking->booking_code,
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'status' => $payment->status,
            'provider' => $payment->provider,
            'payment_method' => $paymentMethod,
            'payment_result_url' => '/payment-result?' . http_build_query([
                'order_id' => $booking->id,
                'order_no' => $booking->booking_code,
                'payment_method' => $paymentMethod,
                'provider' => 'billplz',
            ]),
            'payment_url' => $payment->raw_response['payment_url'] ?? null,
        ]);
    }

    protected function normalizeRequestedPaymentMethod(string $method): string
    {
        return match ($method) {
            'billplz_fpx' => 'billplz_online_banking',
            'billplz_card' => 'billplz_credit_card',
            default => $method,
        };
    }

    protected function resolveBillplzGatewayOption(array $validated, string $type, string $paymentMethod): ?BillplzPaymentGatewayOption
    {
        if ($paymentMethod === 'manual_transfer') {
            return null;
        }

        if ($paymentMethod === 'billplz_online_banking') {
            $optionId = (int) ($validated['billplz_gateway_option_id'] ?? 0);
            if ($optionId <= 0) {
                return null;
            }
            return BillplzPaymentGatewayOption::query()
                ->where('type', $type)
                ->where('gateway_group', 'online_banking')
                ->where('is_active', true)
                ->find($optionId);
        }

        return BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', 'credit_card')
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->first();
    }

    protected function hasActiveBillplzOptions(string $type, string $gatewayGroup): bool
    {
        return BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $gatewayGroup)
            ->where('is_active', true)
            ->exists();
    }

    public function publicLookup(Request $request)
    {
        $validated = $request->validate([
            'order_no' => ['nullable', 'string', 'required_without:order_id'],
            'order_id' => ['nullable', 'integer', 'required_without:order_no'],
        ]);

        $query = Booking::query();
        if (! empty($validated['order_no'])) {
            $query->where('booking_code', $validated['order_no']);
        }

        if (! empty($validated['order_id'])) {
            $query->where('id', (int) $validated['order_id']);
        }

        $booking = $query->first();

        if (! $booking) {
            return $this->respondError('Booking not found.', 404);
        }

        $payment = BookingPayment::query()
            ->where('booking_id', $booking->id)
            ->latest('id')
            ->first();

        return $this->respond([
            'order_id' => (int) $booking->id,
            'order_no' => (string) $booking->booking_code,
            'grand_total' => (float) $booking->deposit_amount,
            'payment_method' => (string) data_get($payment?->raw_response, 'payment_method', 'manual_transfer'),
            'payment_provider' => strtolower((string) ($payment?->provider ?? 'manual')),
            'payment_reference' => (string) ($payment?->ref ?? ''),
            'payment_url' => data_get($payment?->raw_response, 'payment_url'),
            'payment_status' => strtolower((string) ($booking->payment_status ?? 'UNPAID')),
            'status' => strtolower((string) ($booking->status ?? 'HOLD')),
            'bank_account' => data_get($payment?->raw_response, 'bank_account'),
            'uploads' => array_values(array_filter([
                data_get($payment?->raw_response, 'manual_slip_url') ? [
                    'id' => (int) ($payment?->id ?? 0),
                    'file_url' => (string) data_get($payment?->raw_response, 'manual_slip_url'),
                    'note' => data_get($payment?->raw_response, 'manual_slip_note'),
                    'status' => (string) data_get($payment?->raw_response, 'payment_status', 'pending_manual_review'),
                    'created_at' => optional($payment?->updated_at)->toDateTimeString(),
                ] : null,
            ])),
        ]);
    }

    public function publicUploadSlip(Request $request, int $id)
    {
        $validated = $request->validate([
            'order_no' => ['required', 'string'],
            'slip' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf,webp', 'max:5120'],
            'note' => ['nullable', 'string'],
        ]);

        $booking = Booking::query()
            ->where('id', $id)
            ->where('booking_code', $validated['order_no'])
            ->first();

        if (! $booking) {
            return $this->respondError('Booking not found.', 404);
        }

        $payment = BookingPayment::query()->where('booking_id', $booking->id)->latest('id')->first();
        if (! $payment) {
            return $this->respondError('Payment record not found.', 404);
        }

        $path = $validated['slip']->store('booking-payment-slips', 'public');

        $raw = $payment->raw_response ?? [];
        $raw['manual_slip_path'] = $path;
        $raw['manual_slip_url'] = Storage::disk('public')->url($path);
        $raw['manual_slip_note'] = $validated['note'] ?? null;
        $raw['payment_status'] = 'slip_uploaded_pending_review';
        $payment->raw_response = $raw;
        $payment->save();

        return $this->respond([
            'upload' => [
                'id' => (int) $payment->id,
                'file_url' => (string) $raw['manual_slip_url'],
                'note' => $raw['manual_slip_note'] ?? null,
                'status' => (string) $raw['payment_status'],
                'created_at' => optional($payment->updated_at)->toDateTimeString(),
            ],
        ], 'Payment slip uploaded.');
    }

    public function detail(Request $request, int $id)
    {
        $booking = Booking::findOrFail($id);
        $this->authorizeBooking($request, $booking);

        $payment = BookingPayment::query()->where('booking_id', $booking->id)->latest('id')->first();

        return $this->respond([
            'booking_id' => $booking->id,
            'booking_code' => $booking->booking_code,
            'booking_status' => $booking->status,
            'payment_status' => $booking->payment_status,
            'amount' => (float) $booking->deposit_amount,
            'billing_contact' => [
                'name' => $booking->billing_name ?: $booking->guest_name ?: $booking->customer?->name,
                'phone' => $booking->billing_phone ?: $booking->guest_phone ?: $booking->customer?->phone,
                'email' => $booking->billing_email ?: $booking->guest_email ?: $booking->customer?->email,
            ],
            'payment' => $payment ? [
                'id' => $payment->id,
                'status' => $payment->status,
                'provider' => $payment->provider,
                'ref' => $payment->ref,
                'payment_method' => data_get($payment->raw_response, 'payment_method'),
                'payment_url' => data_get($payment->raw_response, 'payment_url'),
                'manual_bank_account' => data_get($payment->raw_response, 'bank_account'),
                'slip_url' => data_get($payment->raw_response, 'manual_slip_url'),
                'manual_status' => data_get($payment->raw_response, 'payment_status'),
            ] : null,
        ]);
    }

    public function uploadSlip(Request $request, int $id)
    {
        $booking = Booking::findOrFail($id);
        $this->authorizeBooking($request, $booking);

        $validated = $request->validate([
            'slip' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $payment = BookingPayment::query()->where('booking_id', $booking->id)->latest('id')->first();
        if (! $payment) {
            return $this->respondError('Payment record not found.', 404);
        }

        $path = $validated['slip']->store('booking-payment-slips', 'public');

        $raw = $payment->raw_response ?? [];
        $raw['manual_slip_path'] = $path;
        $raw['manual_slip_url'] = Storage::disk('public')->url($path);
        $raw['payment_status'] = 'slip_uploaded_pending_review';
        $payment->raw_response = $raw;
        $payment->save();

        return $this->respond([
            'payment_id' => $payment->id,
            'slip_url' => $raw['manual_slip_url'],
            'manual_status' => $raw['payment_status'],
        ], 'Payment slip uploaded.');
    }

    public function callback(Request $request)
    {
        $payload = $request->all();
        $billplzPayload = $payload['billplz'] ?? $payload;

        $isBillplzCallback = isset($billplzPayload['paid']) && isset($billplzPayload['id']) && ! $request->has('status');

        if ($isBillplzCallback) {
            return $this->handleBillplzCallback($request, $billplzPayload);
        }

        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'status' => ['required', 'in:PAID,FAILED'],
            'ref' => ['nullable', 'string'],
        ]);

        $booking = Booking::findOrFail($validated['booking_id']);
        $payment = BookingPayment::where('booking_id', $booking->id)
            ->latest('id')
            ->first();

        if (! $payment) {
            return $this->respondError('Payment record not found.', 404);
        }

        if ($validated['status'] === 'PAID') {
            $payment->update([
                'status' => 'PAID',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => array_merge($payment->raw_response ?? [], $request->all()),
            ]);

            $booking->update([
                'payment_status' => 'PAID',
                'status' => 'CONFIRMED',
                'hold_expires_at' => null,
            ]);

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => ['payment_id' => $payment->id, 'ref' => $payment->ref],
                'created_at' => now(),
            ]);

            $this->bookingConfirmationEmailService->sendForBooking(
                $booking->fresh(['customer', 'service', 'staff']),
                (string) data_get($payment->raw_response, 'payment_method', 'manual_transfer')
            );
        } else {
            $payment->update([
                'status' => 'FAILED',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => array_merge($payment->raw_response ?? [], $request->all()),
            ]);

            $booking->update(['payment_status' => 'FAILED']);
        }

        return $this->respond([
            'booking_id' => $booking->id,
            'booking_status' => $booking->fresh()->status,
            'payment_status' => $booking->fresh()->payment_status,
        ]);
    }

    private function handleBillplzCallback(Request $request, array $billplzPayload)
    {
        $bookingId = $request->query('booking_id');
        $billId = $billplzPayload['id'] ?? null;

        if (! $bookingId) {
            Log::warning('Booking Billplz callback missing booking_id', ['bill_id' => $billId, 'payload' => $billplzPayload]);
            return response('missing booking_id', 400);
        }

        $booking = Booking::find($bookingId);
        if (! $booking) {
            Log::warning('Booking Billplz callback booking not found', ['booking_id' => $bookingId, 'bill_id' => $billId]);
            return response('booking not found', 404);
        }

        $payment = BookingPayment::where('booking_id', $booking->id)->latest('id')->first();
        if (! $payment) {
            Log::warning('Booking Billplz callback payment not found', ['booking_id' => $bookingId, 'bill_id' => $billId]);
            return response('payment not found', 404);
        }

        $paid = filter_var($billplzPayload['paid'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $state = $billplzPayload['state'] ?? null;
        $transactionStatus = $billplzPayload['transaction_status'] ?? null;
        $isPaymentConfirmed = $paid || $state === 'paid' || $transactionStatus === 'completed';

        Log::info('Booking Billplz callback received', [
            'booking_id' => $booking->id,
            'bill_id' => $billId,
            'paid' => $paid,
            'state' => $state,
            'is_confirmed' => $isPaymentConfirmed,
        ]);

        if ($isPaymentConfirmed && $booking->payment_status !== 'PAID') {
            $payment->update([
                'status' => 'PAID',
                'ref' => $billId ?: $payment->ref,
                'raw_response' => array_merge($payment->raw_response ?? [], ['billplz_callback' => $billplzPayload]),
            ]);

            $booking->update([
                'payment_status' => 'PAID',
                'status' => 'CONFIRMED',
                'hold_expires_at' => null,
            ]);

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_CONFIRMED',
                'meta' => ['payment_id' => $payment->id, 'ref' => $billId, 'provider' => 'billplz'],
                'created_at' => now(),
            ]);

            Log::info('Booking Billplz callback confirmed payment', [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'bill_id' => $billId,
            ]);

            $this->bookingConfirmationEmailService->sendForBooking(
                $booking->fresh(['customer', 'service', 'staff']),
                (string) data_get($payment->raw_response, 'payment_method', 'billplz_online_banking')
            );
        } elseif (! $isPaymentConfirmed && $state === 'due') {
            $payment->update([
                'status' => 'FAILED',
                'raw_response' => array_merge($payment->raw_response ?? [], ['billplz_callback' => $billplzPayload]),
            ]);

            $booking->update(['payment_status' => 'FAILED']);

            Log::info('Booking Billplz callback payment failed', [
                'booking_id' => $booking->id,
                'bill_id' => $billId,
                'state' => $state,
            ]);
        }

        return response('OK', 200);
    }

    /**
     * @param array<string,mixed> $gatewayConfig
     * @return array<string,mixed>
     */
    private function createBillplzBill(Booking $booking, string $type, string $paymentMethod, array $gatewayConfig, ?BillplzPaymentGatewayOption $selectedGatewayOption = null): array
    {
        $resolvedConfig = $this->configResolver->resolve($type, $paymentMethod);
        $apiKey = data_get($gatewayConfig, 'api_key') ?: $resolvedConfig['api_key'];
        $collectionId = data_get($gatewayConfig, 'collection_id') ?: $resolvedConfig['collection_id'];
        $baseUrl = BillplzBaseUrl::normalize(
            rtrim((string) (data_get($gatewayConfig, 'base_url') ?: $resolvedConfig['base_url']), '/')
        );
        $frontendUrl = rtrim((string) (data_get($gatewayConfig, 'frontend_url') ?: $resolvedConfig['frontend_url']), '/');
        $publicUrl = rtrim((string) (data_get($gatewayConfig, 'public_url') ?: $resolvedConfig['public_url']), '/');

        $workspaceFrontend = rtrim((string) config("services.frontend_url_{$type}"), '/');
        $bookingRedirectBase = $workspaceFrontend ?: $frontendUrl;

        Log::info('Booking Billplz redirect_url resolution', [
            'workspace_type' => $type,
            'config_key' => "services.frontend_url_{$type}",
            'workspace_frontend_from_config' => $workspaceFrontend ?: '(empty)',
            'gateway_config_frontend_url' => data_get($gatewayConfig, 'frontend_url') ?: '(empty)',
            'resolver_frontend_url' => $resolvedConfig['frontend_url'] ?? '(empty)',
            'final_frontendUrl_var' => $frontendUrl,
            'final_redirect_base' => $bookingRedirectBase ?: '(empty)',
        ]);

        if (! $apiKey || ! $collectionId) {
            abort(response()->json(['success' => false, 'message' => 'Billplz is not configured for booking workspace.', 'data' => null], 422));
        }

        $redirectUrl = $bookingRedirectBase
            ? $bookingRedirectBase . '/payment-result?' . http_build_query([
                'order_id' => $booking->id,
                'order_no' => $booking->booking_code,
                'provider' => 'billplz',
                'payment_method' => $paymentMethod,
            ])
            : null;

        $callbackUrl = $publicUrl ? "{$publicUrl}/api/booking/payment/callback?booking_id={$booking->id}" : null;

        $contactName = $booking->billing_name ?: $booking->guest_name ?: $booking->customer?->name ?: 'Booking Customer';
        $contactPhone = $booking->billing_phone ?: $booking->guest_phone ?: $booking->customer?->phone;
        $contactEmail = $booking->billing_email ?: $booking->guest_email ?: $booking->customer?->email;

        if (! $contactPhone && ! $contactEmail) {
            abort(response()->json(['success' => false, 'message' => 'Please provide a contact phone or email for the payment.', 'data' => null], 422));
        }

        $isDirectChannel = in_array($paymentMethod, ['billplz_online_banking', 'billplz_credit_card'], true) && ! empty($selectedGatewayOption?->code);

        $payload = array_filter([
            'collection_id' => $collectionId,
            'email' => $contactEmail,
            'mobile' => $contactPhone,
            'name' => $contactName,
            'amount' => (int) round(((float) $booking->deposit_amount) * 100),
            'description' => 'Booking ' . ($booking->booking_code ?: $booking->id),
            'callback_url' => $callbackUrl,
            'redirect_url' => $redirectUrl,
            'reference_1_label' => $isDirectChannel ? 'Bank Code' : 'BookingCode',
            'reference_1' => $isDirectChannel ? $selectedGatewayOption?->code : ($booking->booking_code ?: (string) $booking->id),
            'reference_2_label' => $isDirectChannel ? 'BookingCode' : null,
            'reference_2' => $isDirectChannel ? ($booking->booking_code ?: (string) $booking->id) : null,
        ], fn($value) => $value !== null && $value !== '');

        $response = Http::asForm()
            ->withBasicAuth((string) $apiKey, '')
            ->acceptJson()
            ->post("{$baseUrl}/bills", $payload);

        if (! $response->successful()) {
            $errorBody = $response->json() ?? [];
            $message = data_get($errorBody, 'error.message');
            if (is_array($message)) {
                $message = implode(', ', $message);
            }
            abort(response()->json(['success' => false, 'message' => 'Failed to create Billplz bill: ' . ($message ?: $response->body()), 'data' => null], 422));
        }

        $responseData = (array) $response->json();
        $originalUrl = (string) data_get($responseData, 'url', '');
        $finalUrl = $this->resolvePaymentUrl($originalUrl, $isDirectChannel);
        if ($finalUrl !== '' && $finalUrl !== $originalUrl) {
            $responseData['url'] = $finalUrl;
        }

        Log::info('Booking Billplz bill created with routing context', [
            'booking_id' => $booking->id,
            'payment_method' => $paymentMethod,
            'billplz_gateway_option_id' => $selectedGatewayOption?->id,
            'selected_gateway_code' => $selectedGatewayOption?->code,
            'is_direct_channel' => $isDirectChannel,
            'bill_payload' => $payload,
            'billplz_response' => $responseData,
            'billplz_original_url' => $originalUrl,
            'billplz_final_url' => data_get($responseData, 'url'),
            'fallback_to_generic' => ! $isDirectChannel,
        ]);

        return $responseData;
    }

    private function resolvePaymentUrl(string $url, bool $isDirectChannel): string
    {
        if ($url === '' || ! $isDirectChannel) {
            return $url;
        }

        return $url . (str_contains($url, '?') ? '&' : '?') . http_build_query(['auto_submit' => 'true']);
    }

    private function authorizeBooking(Request $request, Booking $booking): void
    {
        $customer = $request->user('customer');
        if ($customer && (int) $booking->customer_id === (int) $customer->id) {
            return;
        }

        if ($booking->source === 'GUEST' && empty($booking->customer_id)) {
            $guestToken = (string) $request->header('X-Booking-Guest-Token', '');
            $storedToken = '';

            if (is_string($booking->notes) && str_starts_with($booking->notes, 'guest_token:')) {
                $storedToken = substr($booking->notes, strlen('guest_token:'));
            }

            abort_unless($guestToken !== '' && hash_equals($storedToken, $guestToken), 403, 'Forbidden booking access.');
            return;
        }

        abort(403, 'Forbidden booking access.');
    }

    /**
     * @return array<string,mixed>
     */
    private function mapBankAccount(BankAccount $bankAccount): array
    {
        return [
            'id' => $bankAccount->id,
            'label' => $bankAccount->label,
            'bank_name' => $bankAccount->bank_name,
            'account_name' => $bankAccount->account_name,
            'account_number' => $bankAccount->account_number,
            'branch' => $bankAccount->branch,
            'swift_code' => $bankAccount->swift_code,
            'logo_url' => $bankAccount->logo_url,
            'qr_image_url' => $bankAccount->qr_image_url,
            'instructions' => $bankAccount->instructions,
        ];
    }
}
