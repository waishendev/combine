<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingPayment;
use App\Models\Ecommerce\PaymentGateway;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    public function pay(Request $request, int $id)
    {
        $type = WorkspaceType::fromRequest($request, WorkspaceType::BOOKING);
        $validated = $request->validate([
            'payment_method' => ['nullable', 'string', 'in:manual_transfer,billplz_fpx,billplz_card'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ]);

        $booking = Booking::with('customer')->findOrFail($id);
        $this->authorizeBooking($request, $booking);

        if (! in_array($booking->status, ['HOLD', 'CONFIRMED'], true)) {
            return $this->respondError('Only HOLD/CONFIRMED booking can be paid.', 422);
        }

        $paymentMethod = $validated['payment_method'] ?? 'manual_transfer';

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
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'status' => $payment->status,
                'provider' => $payment->provider,
                'payment_method' => $paymentMethod,
                'manual_bank_account' => $payment->raw_response['bank_account'] ?? null,
            ]);
        }

        $gateway = PaymentGateway::query()
            ->where('type', $type)
            ->where('key', $paymentMethod)
            ->where('is_active', true)
            ->first();

        if (! $gateway) {
            return $this->respondError('Selected payment gateway is not available.', 422);
        }

        $billplz = $this->createBillplzBill($booking, $type, $paymentMethod, $gateway->config ?? []);

        $payment = BookingPayment::create([
            'booking_id' => $booking->id,
            'provider' => strtoupper($paymentMethod),
            'amount' => $booking->deposit_amount,
            'status' => 'PENDING',
            'ref' => (string) (data_get($billplz, 'id') ?: ('BKG-' . $booking->id . '-' . now()->timestamp)),
            'raw_response' => [
                'type' => $type,
                'payment_method' => $paymentMethod,
                'billplz' => $billplz,
                'payment_url' => data_get($billplz, 'url'),
            ],
        ]);

        return $this->respond([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'status' => $payment->status,
            'provider' => $payment->provider,
            'payment_method' => $paymentMethod,
            'payment_url' => $payment->raw_response['payment_url'] ?? null,
        ]);
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

    /**
     * @param array<string,mixed> $gatewayConfig
     * @return array<string,mixed>
     */
    private function createBillplzBill(Booking $booking, string $type, string $paymentMethod, array $gatewayConfig): array
    {
        $fallbackConfig = PaymentGateway::query()
            ->where('type', $type)
            ->where('key', 'billplz_fpx')
            ->where('is_active', true)
            ->value('config');

        $apiKey = data_get($gatewayConfig, 'api_key') ?: data_get($fallbackConfig, 'api_key') ?: config('services.billplz.api_key');
        $collectionId = data_get($gatewayConfig, 'collection_id') ?: data_get($fallbackConfig, 'collection_id') ?: config('services.billplz.collection_id');
        $baseUrl = rtrim((string) (data_get($gatewayConfig, 'base_url') ?: data_get($fallbackConfig, 'base_url') ?: config('services.billplz.base_url') ?: 'https://www.billplz.com/api/v3'), '/');
        $frontendUrl = rtrim((string) (data_get($gatewayConfig, 'frontend_url') ?: data_get($fallbackConfig, 'frontend_url') ?: config('services.billplz.frontend_url') ?: ''), '/');
        $publicUrl = rtrim((string) (data_get($gatewayConfig, 'public_url') ?: data_get($fallbackConfig, 'public_url') ?: config('services.billplz.public_url') ?: config('app.url') ?: ''), '/');

        if (! $apiKey || ! $collectionId) {
            abort(response()->json(['success' => false, 'message' => 'Billplz is not configured for booking workspace.', 'data' => null], 422));
        }

        $redirectUrl = $frontendUrl
            ? $frontendUrl . '/booking/payment-result?' . http_build_query([
                'booking_id' => $booking->id,
                'provider' => 'billplz',
                'payment_method' => $paymentMethod,
            ])
            : null;

        $callbackUrl = $publicUrl ? "{$publicUrl}/api/booking/payment/callback?booking_id={$booking->id}" : null;

        $contactName = $booking->customer?->name ?: $booking->guest_name ?: 'Booking Customer';
        $contactPhone = $booking->customer?->phone ?: $booking->guest_phone;
        $contactEmail = $booking->customer?->email ?: $booking->guest_email;

        if (! $contactPhone && ! $contactEmail) {
            abort(response()->json(['success' => false, 'message' => 'Please provide a contact phone or email for the payment.', 'data' => null], 422));
        }

        $payload = array_filter([
            'collection_id' => $collectionId,
            'email' => $contactEmail,
            'mobile' => $contactPhone,
            'name' => $contactName,
            'amount' => (int) round(((float) $booking->deposit_amount) * 100),
            'description' => 'Booking ' . ($booking->booking_code ?: $booking->id),
            'callback_url' => $callbackUrl,
            'redirect_url' => $redirectUrl,
            'reference_1_label' => 'BookingCode',
            'reference_1' => $booking->booking_code ?: (string) $booking->id,
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

        return (array) $response->json();
    }

    private function authorizeBooking(Request $request, Booking $booking): void
    {
        $customer = $request->user('customer');
        abort_unless($customer && (int) $booking->customer_id === (int) $customer->id, 403, 'Forbidden booking access.');
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
