<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BillplzPaymentGatewayOption;
use App\Models\Booking\BookingPaymentLink;
use App\Services\Booking\BookingPaymentLinkService;
use App\Services\Booking\BookingServiceBlocksResolver;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PaymentLinkController extends Controller
{
    public function __construct(
        protected BookingPaymentLinkService $service,
        protected BookingServiceBlocksResolver $serviceBlocksResolver,
    ) {
    }

    /**
     * Public: read a deposit payment link by token (guest or member, no auth required).
     */
    public function show(Request $request, string $token)
    {
        $link = $this->findLink($token);
        if (! $link) {
            return $this->respondError('Payment link not found.', 404);
        }

        $this->service->refreshStatus($link);

        return $this->respond($this->present($link));
    }

    /**
     * Public: start a payment for the link.
     */
    public function pay(Request $request, string $token)
    {
        $link = $this->findLink($token);
        if (! $link) {
            return $this->respondError('Payment link not found.', 404);
        }

        $this->service->refreshStatus($link);
        if (! $link->isPayable()) {
            return $this->respondError('This payment link is no longer available.', 422, ['status' => $link->status]);
        }

        $validated = $request->validate([
            'payment_method' => ['required', 'string', 'in:manual_transfer,billplz_fpx,billplz_card,billplz_online_banking,billplz_credit_card'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'billplz_gateway_option_id' => ['nullable', 'integer', 'exists:billplz_payment_gateway_options,id'],
            'payer_name' => ['required', 'string', 'max:120'],
            'payer_phone' => ['required', 'string', 'max:40'],
            'payer_email' => ['nullable', 'email', 'max:160'],
        ]);

        $paymentMethod = $this->normalizeMethod((string) $validated['payment_method']);
        $payer = [
            'name' => $validated['payer_name'] ?? null,
            'phone' => $validated['payer_phone'] ?? null,
            'email' => $validated['payer_email'] ?? null,
        ];

        // Attach a logged-in member as the payer without ever changing the booking owner.
        $customer = $request->user('customer');
        if ($customer) {
            $payer['customer_id'] = (int) $customer->id;
            $payer['name'] = $payer['name'] ?: $customer->name;
            $payer['phone'] = $payer['phone'] ?: $customer->phone;
            $payer['email'] = $payer['email'] ?: $customer->email;
        }

        if ($paymentMethod === 'manual_transfer') {
            return $this->startManualTransfer($link, $validated, $payer);
        }

        return $this->startBillplz($link, $validated, $paymentMethod, $payer);
    }

    /**
     * Public: upload a manual transfer slip for the link.
     */
    public function uploadSlip(Request $request, string $token)
    {
        $link = $this->findLink($token);
        if (! $link) {
            return $this->respondError('Payment link not found.', 404);
        }

        $this->service->refreshStatus($link);
        if (! $link->isPayable()) {
            return $this->respondError('This payment link is no longer available.', 422, ['status' => $link->status]);
        }

        $validated = $request->validate([
            'slip' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf,webp', 'max:5120'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $path = $validated['slip']->store('booking-payment-slips', 'public');

        $link->update([
            'provider' => 'manual_transfer',
            'manual_slip_path' => $path,
            'manual_slip_url' => Storage::disk('public')->url($path),
            'manual_review_status' => 'slip_uploaded_pending_review',
            'notes' => $validated['note'] ?? $link->notes,
        ]);

        return $this->respond([
            'status' => $link->status,
            'manual_review_status' => $link->manual_review_status,
            'manual_slip_url' => $link->manual_slip_url,
        ], 'Payment slip uploaded. We will confirm your deposit shortly.');
    }

    /**
     * Public: remove a not-yet-approved manual transfer slip so the customer can re-upload.
     */
    public function cancelSlip(Request $request, string $token)
    {
        $link = $this->findLink($token);
        if (! $link) {
            return $this->respondError('Payment link not found.', 404);
        }

        if ($link->status === 'PAID') {
            return $this->respondError('This deposit has already been confirmed.', 422);
        }

        $this->service->refreshStatus($link);
        if (! $link->isPayable()) {
            return $this->respondError('This payment link is no longer available.', 422, ['status' => $link->status]);
        }

        if ($link->manual_slip_path) {
            Storage::disk('public')->delete($link->manual_slip_path);
        }

        $link->update([
            'manual_slip_path' => null,
            'manual_slip_url' => null,
            'manual_review_status' => 'awaiting_slip',
        ]);

        return $this->respond([
            'status' => $link->status,
            'manual_review_status' => $link->manual_review_status,
        ], 'Payment proof removed. You can upload a new one.');
    }

    /**
     * Public: Billplz callback for link payments (token in query string).
     */
    public function callback(Request $request)
    {
        $payload = $request->all();
        $billplzPayload = $payload['billplz'] ?? $payload;
        $token = (string) $request->query('token', '');

        $link = $this->findLink($token);
        if (! $link) {
            Log::warning('Payment link Billplz callback: link not found', ['token' => $token]);
            return response('link not found', 404);
        }

        $paid = filter_var($billplzPayload['paid'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $state = $billplzPayload['state'] ?? null;
        $billId = $billplzPayload['id'] ?? $link->payment_ref;
        $isConfirmed = $paid || $state === 'paid';

        Log::info('Payment link Billplz callback received', [
            'payment_link_id' => $link->id,
            'bill_id' => $billId,
            'paid' => $paid,
            'state' => $state,
        ]);

        if ($isConfirmed && $link->status !== 'PAID') {
            try {
                $this->service->markPaidAndRecordDeposit(
                    link: $link,
                    provider: $link->provider ?: 'billplz',
                    ref: (string) $billId,
                    payer: [
                        'customer_id' => $link->payer_customer_id,
                        'name' => $link->payer_name,
                        'phone' => $link->payer_phone,
                        'email' => $link->payer_email,
                    ],
                    rawContext: ['billplz_callback' => $billplzPayload],
                );
            } catch (Throwable $e) {
                Log::error('Payment link Billplz callback failed to record deposit', [
                    'payment_link_id' => $link->id,
                    'error' => $e->getMessage(),
                ]);
                return response('error', 500);
            }
        }

        return response('OK', 200);
    }

    protected function startManualTransfer(BookingPaymentLink $link, array $validated, array $payer)
    {
        $bankAccountId = $validated['bank_account_id'] ?? null;
        if (! $bankAccountId) {
            return $this->respondError('bank_account_id is required for manual transfer.', 422);
        }

        $bankAccount = BankAccount::query()
            ->where('type', WorkspaceType::BOOKING)
            ->where('is_active', true)
            ->find($bankAccountId);

        if (! $bankAccount) {
            return $this->respondError('Selected bank account is not available.', 422);
        }

        $link->update([
            'provider' => 'manual_transfer',
            'manual_review_status' => $link->manual_review_status ?: 'awaiting_slip',
            'payer_customer_id' => $payer['customer_id'] ?? $link->payer_customer_id,
            'payer_name' => $payer['name'] ?? $link->payer_name,
            'payer_phone' => $payer['phone'] ?? $link->payer_phone,
            'payer_email' => $payer['email'] ?? $link->payer_email,
        ]);

        return $this->respond([
            'status' => $link->status,
            'payment_method' => 'manual_transfer',
            'requires_slip_upload' => true,
            'manual_bank_account' => $this->mapBankAccount($bankAccount),
        ], 'Please transfer the deposit and upload your payment slip.');
    }

    protected function startBillplz(BookingPaymentLink $link, array $validated, string $paymentMethod, array $payer)
    {
        $option = $this->resolveGatewayOption($validated, $paymentMethod);
        if ($paymentMethod === 'billplz_online_banking' && ! $option && $this->hasActiveOptions('online_banking')) {
            return $this->respondError('Selected online banking option is not available.', 422);
        }
        if ($paymentMethod === 'billplz_credit_card' && ! $option && $this->hasActiveOptions('credit_card')) {
            return $this->respondError('Credit card payment is not available.', 422);
        }

        try {
            $billplz = $this->service->createBillplzBillForLink($link, $paymentMethod, $option, $payer);
        } catch (Throwable $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        $link->update([
            'provider' => $paymentMethod,
            'payment_ref' => (string) (data_get($billplz, 'id') ?: $link->payment_ref),
            'payer_customer_id' => $payer['customer_id'] ?? $link->payer_customer_id,
            'payer_name' => $payer['name'] ?? $link->payer_name,
            'payer_phone' => $payer['phone'] ?? $link->payer_phone,
            'payer_email' => $payer['email'] ?? $link->payer_email,
        ]);

        return $this->respond([
            'status' => $link->status,
            'payment_method' => $paymentMethod,
            'payment_url' => data_get($billplz, 'url'),
        ]);
    }

    protected function findLink(string $token): ?BookingPaymentLink
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        return BookingPaymentLink::query()
            ->with(['booking.service', 'booking.staff', 'booking.customer'])
            ->where('token', $token)
            ->first();
    }

    protected function normalizeMethod(string $method): string
    {
        return match ($method) {
            'billplz_fpx' => 'billplz_online_banking',
            'billplz_card' => 'billplz_credit_card',
            default => $method,
        };
    }

    protected function resolveGatewayOption(array $validated, string $paymentMethod): ?BillplzPaymentGatewayOption
    {
        $group = $paymentMethod === 'billplz_credit_card' ? 'credit_card' : 'online_banking';
        $optionId = (int) ($validated['billplz_gateway_option_id'] ?? 0);

        $query = BillplzPaymentGatewayOption::query()
            ->where('type', WorkspaceType::BOOKING)
            ->where('gateway_group', $group)
            ->where('is_active', true);

        if ($optionId > 0) {
            return $query->find($optionId);
        }

        if ($group === 'credit_card') {
            return $query->orderByDesc('is_default')->orderBy('sort_order')->first();
        }

        return null;
    }

    protected function hasActiveOptions(string $group): bool
    {
        return BillplzPaymentGatewayOption::query()
            ->where('type', WorkspaceType::BOOKING)
            ->where('gateway_group', $group)
            ->where('is_active', true)
            ->exists();
    }

    /**
     * @return array<string,mixed>
     */
    protected function present(BookingPaymentLink $link): array
    {
        $booking = $link->booking;

        $appointment = null;
        if ($booking) {
            $serviceBlocks = $this->serviceBlocksResolver->blocks($booking);

            $serviceTotal = round(collect($serviceBlocks)->sum(fn (array $block) => (float) ($block['amount'] ?? 0)), 2);
            $addonTotal = round(collect($serviceBlocks)->sum(
                fn (array $block) => collect($block['add_ons'] ?? [])->sum(fn (array $addon) => (float) ($addon['line_gross_amount'] ?? 0))
            ), 2);
            $durationMin = (int) collect($serviceBlocks)->sum(
                fn (array $block) => (int) ($block['duration_min'] ?? 0)
                    + collect($block['add_ons'] ?? [])->sum(fn (array $addon) => (int) ($addon['extra_duration_min'] ?? 0))
            );

            $appointment = [
                'booking_code' => (string) $booking->booking_code,
                'service_name' => (string) ($booking->service?->name ?? 'Service'),
                'staff_name' => (string) ($booking->staff?->name ?? ''),
                'start_at' => optional($booking->start_at)->toDateTimeString(),
                'end_at' => optional($booking->end_at)->toDateTimeString(),
                'customer_name' => $booking->customer?->name ?: $booking->guest_name ?: null,
                'service_blocks' => $serviceBlocks,
                'service_total' => $serviceTotal,
                'addon_total' => $addonTotal,
                'items_total' => round($serviceTotal + $addonTotal, 2),
                'deposit_collected' => round((float) ($booking->deposit_amount ?? 0), 2),
                'estimated_duration_min' => $durationMin,
                'multi_service' => count($serviceBlocks) > 1,
            ];
        }

        return [
            'token' => (string) $link->token,
            'status' => (string) $link->status,
            'purpose' => (string) $link->purpose,
            'amount' => (float) $link->amount,
            'is_payable' => $link->isPayable(),
            'expires_at' => optional($link->expires_at)->toDateTimeString(),
            'paid_at' => optional($link->paid_at)->toDateTimeString(),
            'provider' => $link->provider,
            'manual_review_status' => $link->manual_review_status,
            'manual_slip_url' => $link->manual_slip_url,
            'appointment' => $appointment,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    protected function mapBankAccount(BankAccount $bankAccount): array
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
