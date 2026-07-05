<?php

namespace App\Services\Booking;

use App\Http\Controllers\Ecommerce\PosController;
use App\Models\BillplzPaymentGatewayOption;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingPaymentLink;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\PaymentGateway;
use App\Services\Ecommerce\OrderPaymentService;
use App\Services\Payments\BillplzConfigResolver;
use App\Support\BillplzBaseUrl;
use App\Support\WorkspaceType;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class BookingPaymentLinkService
{
    /** Default lifetime of a generated deposit link when the staff does not override it. */
    public const DEFAULT_EXPIRY_HOURS = 72;

    public function __construct(
        protected BillplzConfigResolver $configResolver,
        protected OrderPaymentService $orderPaymentService,
    ) {
    }

    /**
     * Generate a new PENDING deposit link for an appointment.
     */
    public function create(
        Booking $booking,
        float $amount,
        string $purpose = 'DEPOSIT',
        ?Carbon $expiresAt = null,
        ?int $staffId = null,
        ?string $notes = null,
    ): BookingPaymentLink {
        $amount = round($amount, 2);
        if ($amount <= 0) {
            throw new RuntimeException('Payment link amount must be greater than zero.');
        }

        return BookingPaymentLink::create([
            'booking_id' => (int) $booking->id,
            'token' => $this->generateToken(),
            'purpose' => $purpose,
            'amount' => $amount,
            'status' => 'PENDING',
            'expires_at' => $expiresAt ?? now()->addHours(self::DEFAULT_EXPIRY_HOURS),
            'created_by' => $staffId,
            'notes' => $notes,
        ]);
    }

    /**
     * Public customer-facing URL that opens the deposit link in the booking shop.
     */
    public function publicUrl(BookingPaymentLink $link): string
    {
        $base = rtrim((string) config('services.frontend_url_booking', config('services.frontend_url', config('app.url'))), '/');

        return $base . '/pay/' . $link->token;
    }

    /**
     * Reflect the effective status (auto-expire PENDING links that passed their window).
     */
    public function refreshStatus(BookingPaymentLink $link): BookingPaymentLink
    {
        if ($link->status === 'PENDING' && $link->isExpired()) {
            $link->update(['status' => 'EXPIRED']);
        }

        return $link;
    }

    /**
     * Cancel (invalidate) a link. Only unpaid links become CANCELLED. This never touches
     * money that was already collected — refunds are a separate business flow.
     */
    public function cancel(BookingPaymentLink $link, ?int $staffId = null): BookingPaymentLink
    {
        if ($link->status === 'PAID') {
            throw new RuntimeException('A paid payment link cannot be cancelled.');
        }

        if (in_array($link->status, ['CANCELLED', 'EXPIRED'], true)) {
            return $link;
        }

        $link->update([
            'status' => 'CANCELLED',
            'cancelled_by' => $staffId,
            'cancelled_at' => now(),
        ]);

        BookingLog::create([
            'booking_id' => $link->booking_id,
            'actor_type' => 'STAFF',
            'actor_id' => $staffId,
            'action' => 'PAYMENT_LINK_CANCELLED',
            'meta' => ['payment_link_id' => $link->id, 'amount' => (float) $link->amount],
            'created_at' => now(),
        ]);

        return $link;
    }

    /**
     * Create a Billplz bill for the link amount (independent of the appointment deposit_amount).
     *
     * @return array<string,mixed> Billplz bill response (contains `url`).
     */
    public function createBillplzBillForLink(
        BookingPaymentLink $link,
        string $paymentMethod,
        ?BillplzPaymentGatewayOption $selectedGatewayOption,
        array $payer = [],
    ): array {
        $type = WorkspaceType::BOOKING;
        $booking = $link->booking;

        $gatewayKey = $paymentMethod === 'billplz_credit_card' ? 'billplz_card' : 'billplz_fpx';
        $gateway = PaymentGateway::query()
            ->where('type', $type)
            ->where('key', $gatewayKey)
            ->where('is_active', true)
            ->first();

        if (! $gateway) {
            throw new RuntimeException('Selected payment gateway is not available.');
        }

        $gatewayConfig = (array) ($gateway->config ?? []);
        $resolvedConfig = $this->configResolver->resolve($type, $paymentMethod);

        $apiKey = data_get($gatewayConfig, 'api_key') ?: $resolvedConfig['api_key'];
        $collectionId = data_get($gatewayConfig, 'collection_id') ?: $resolvedConfig['collection_id'];
        $baseUrl = BillplzBaseUrl::normalize(
            rtrim((string) (data_get($gatewayConfig, 'base_url') ?: $resolvedConfig['base_url']), '/')
        );
        $publicUrl = rtrim((string) (data_get($gatewayConfig, 'public_url') ?: $resolvedConfig['public_url']), '/');

        if (! $apiKey || ! $collectionId) {
            throw new RuntimeException('Billplz is not configured for the booking workspace.');
        }

        $redirectUrl = $this->publicUrl($link) . '?' . http_build_query([
            'provider' => 'billplz',
            'payment_method' => $paymentMethod,
        ]);
        $callbackUrl = $publicUrl
            ? "{$publicUrl}/api/public/payment-links/callback?token={$link->token}"
            : null;

        $contactName = $payer['name']
            ?? ($booking?->billing_name ?: $booking?->guest_name ?: $booking?->customer?->name ?: 'Booking Customer');
        $contactPhone = $payer['phone']
            ?? ($booking?->billing_phone ?: $booking?->guest_phone ?: $booking?->customer?->phone);
        $contactEmail = $payer['email']
            ?? ($booking?->billing_email ?: $booking?->guest_email ?: $booking?->customer?->email);

        if (! $contactPhone && ! $contactEmail) {
            throw new RuntimeException('Please provide a contact phone or email for the payment.');
        }

        $isDirectChannel = in_array($paymentMethod, ['billplz_online_banking', 'billplz_credit_card'], true)
            && ! empty($selectedGatewayOption?->code);

        $reference = $booking?->booking_code ?: (string) $link->booking_id;

        $payload = array_filter([
            'collection_id' => $collectionId,
            'email' => $contactEmail,
            'mobile' => $contactPhone,
            'name' => $contactName,
            'amount' => (int) round(((float) $link->amount) * 100),
            'description' => 'Deposit ' . $reference,
            'callback_url' => $callbackUrl,
            'redirect_url' => $redirectUrl,
            'reference_1_label' => $isDirectChannel ? 'Bank Code' : 'DepositLink',
            'reference_1' => $isDirectChannel ? $selectedGatewayOption?->code : $link->token,
            'reference_2_label' => $isDirectChannel ? 'DepositLink' : null,
            'reference_2' => $isDirectChannel ? $link->token : null,
        ], fn ($value) => $value !== null && $value !== '');

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
            throw new RuntimeException('Failed to create Billplz bill: ' . ($message ?: $response->body()));
        }

        $responseData = (array) $response->json();
        $originalUrl = (string) data_get($responseData, 'url', '');
        if ($isDirectChannel && $originalUrl !== '') {
            $responseData['url'] = $originalUrl . (str_contains($originalUrl, '?') ? '&' : '?') . http_build_query(['auto_submit' => 'true']);
        }

        Log::info('Booking payment link Billplz bill created', [
            'payment_link_id' => $link->id,
            'booking_id' => $link->booking_id,
            'payment_method' => $paymentMethod,
            'bill_id' => data_get($responseData, 'id'),
        ]);

        return $responseData;
    }

    /**
     * Mark a link as PAID and record the collected amount as a booking deposit so it credits
     * the appointment balance (mirrors the offline POS "add deposit" flow). Idempotent.
     */
    public function markPaidAndRecordDeposit(
        BookingPaymentLink $link,
        string $provider,
        ?string $ref = null,
        array $payer = [],
        array $rawContext = [],
    ): BookingPaymentLink {
        if ($link->status === 'PAID') {
            return $link;
        }

        $booking = $link->booking()->with(['service', 'customer'])->first();
        if (! $booking) {
            throw new RuntimeException('Appointment not found for payment link.');
        }

        $amount = round((float) $link->amount, 2);
        $serviceName = (string) ($booking->service?->name ?? 'Service');
        $normalizedProvider = strtolower($provider);

        DB::transaction(function () use ($link, $booking, $amount, $serviceName, $provider, $normalizedProvider, $ref, $payer, $rawContext) {
            $order = Order::query()->create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $booking->customer_id ? (int) $booking->customer_id : null,
                'created_by_user_id' => $link->created_by,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $normalizedProvider,
                'payment_provider' => str_starts_with($normalizedProvider, 'billplz') ? 'billplz' : 'manual',
                'payment_reference' => $ref,
                'subtotal' => $amount,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $amount,
                'pickup_or_shipping' => 'in_store',
                'billing_name' => $booking->customer?->name ?? ($booking->guest_name ?: ($payer['name'] ?? null)),
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'Online deposit via payment link #' . $link->id . ' | booking_id=' . $booking->id . ' | booking_deposit=' . number_format($amount, 2, '.', ''),
            ]);

            $depositOrderItem = OrderItem::query()->create([
                'order_id' => (int) $order->id,
                'line_type' => 'booking_deposit',
                'product_name_snapshot' => 'Booking Deposit - ' . $serviceName,
                'display_name_snapshot' => 'Booking Deposit - ' . $serviceName,
                'quantity' => 1,
                'price_snapshot' => $amount,
                'unit_price_snapshot' => $amount,
                'line_total' => $amount,
                'line_total_snapshot' => $amount,
                'effective_unit_price' => $amount,
                'effective_line_total' => $amount,
                'line_total_after_discount' => $amount,
                'locked' => true,
                'booking_id' => (int) $booking->id,
                'booking_service_id' => (int) ($booking->service_id ?? 0),
                'discount_remark' => 'Online deposit link',
            ]);

            $order->payments()->create([
                'payment_method' => $normalizedProvider,
                'amount' => $amount,
                'reference_no' => $ref,
                'meta' => ['source' => 'booking_payment_link', 'payment_link_id' => $link->id],
            ]);

            $bookingPayment = BookingPayment::query()->create([
                'booking_id' => (int) $booking->id,
                'provider' => strtoupper($provider),
                'ref' => $ref ?: (string) $order->order_number,
                'amount' => $amount,
                'status' => 'PAID',
                'raw_response' => array_merge([
                    'source' => 'booking_payment_link',
                    'payment_link_id' => $link->id,
                    'order_id' => (int) $order->id,
                    'order_item_id' => (int) $depositOrderItem->id,
                    'payment_method' => $normalizedProvider,
                ], $rawContext),
            ]);

            $link->update([
                'status' => 'PAID',
                'provider' => $normalizedProvider,
                'payment_ref' => $ref,
                'order_id' => (int) $order->id,
                'booking_payment_id' => (int) $bookingPayment->id,
                'manual_review_status' => $link->manual_slip_path ? 'approved' : $link->manual_review_status,
                'paid_at' => now(),
                'payer_customer_id' => $payer['customer_id'] ?? $link->payer_customer_id,
                'payer_name' => $payer['name'] ?? $link->payer_name,
                'payer_phone' => $payer['phone'] ?? $link->payer_phone,
                'payer_email' => $payer['email'] ?? $link->payer_email,
            ]);

            $this->orderPaymentService->handlePaid($order->fresh(['items']));

            // Reuse the existing appointment financial engine to keep deposit + commission state in sync.
            app(PosController::class)->refreshBookingFinancialState($booking->fresh(['service']));

            BookingLog::create([
                'booking_id' => (int) $booking->id,
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'PAYMENT_LINK_PAID',
                'meta' => [
                    'payment_link_id' => $link->id,
                    'order_id' => (int) $order->id,
                    'provider' => $normalizedProvider,
                    'amount' => $amount,
                ],
                'created_at' => now(),
            ]);
        });

        return $link->fresh();
    }

    protected function generateToken(): string
    {
        do {
            $token = 'pl_' . Str::lower(Str::random(48));
        } while (BookingPaymentLink::query()->where('token', $token)->exists());

        return $token;
    }

    protected function generateOrderNumber(): string
    {
        return 'DEP-' . Carbon::now()->format('YmdHis') . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }
}
