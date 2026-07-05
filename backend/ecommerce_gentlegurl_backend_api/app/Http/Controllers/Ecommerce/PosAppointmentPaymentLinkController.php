<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingPaymentLink;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Services\Booking\BookingPaymentLinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class PosAppointmentPaymentLinkController extends Controller
{
    public function __construct(
        protected BookingPaymentLinkService $service,
    ) {
    }

    /**
     * List all payment links that have a manual-transfer slip awaiting staff review,
     * across every appointment. Used by the CRM Request Center.
     */
    public function pendingReview(Request $request)
    {
        $links = BookingPaymentLink::query()
            ->with(['createdBy:id,name', 'booking:id,booking_code,customer_id,guest_name,guest_phone,guest_email,service_id,staff_id,start_at', 'booking.customer:id,name,phone,email', 'booking.service:id,name', 'booking.staff:id,name'])
            ->where('status', 'PENDING')
            ->where('manual_review_status', 'slip_uploaded_pending_review')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (BookingPaymentLink $link) => $this->serializeForReview($link))
            ->all();

        return $this->respond(['payment_links' => $links]);
    }

    /**
     * List all deposit payment links for an appointment.
     */
    public function index(Request $request, int $id)
    {
        $booking = Booking::query()->findOrFail($id);

        $links = BookingPaymentLink::query()
            ->with('createdBy:id,name')
            ->where('booking_id', (int) $booking->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (BookingPaymentLink $link) => $this->serialize($this->service->refreshStatus($link)))
            ->all();

        return $this->respond(['payment_links' => $links]);
    }

    /**
     * Generate a new deposit payment link for an appointment.
     */
    public function store(Request $request, int $id)
    {
        $booking = Booking::query()->findOrFail($id);

        if (in_array(strtoupper((string) $booking->status), ['CANCELLED', 'VOID', 'VOIDED'], true)) {
            return $this->respondError(__('Cannot create a payment link for a cancelled appointment.'), 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'purpose' => ['nullable', 'string', 'in:DEPOSIT'],
            'expires_at' => ['nullable', 'date'],
            'expires_in_hours' => ['nullable', 'integer', 'min:1', 'max:8760'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $expiresAt = null;
        if (! empty($validated['expires_at'])) {
            $expiresAt = Carbon::parse($validated['expires_at']);
        } elseif (! empty($validated['expires_in_hours'])) {
            $expiresAt = now()->addHours((int) $validated['expires_in_hours']);
        }

        try {
            $link = $this->service->create(
                booking: $booking,
                amount: (float) $validated['amount'],
                purpose: (string) ($validated['purpose'] ?? 'DEPOSIT'),
                expiresAt: $expiresAt,
                staffId: (int) $request->user()->id,
                notes: $validated['notes'] ?? null,
            );
        } catch (Throwable $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond(
            ['payment_link' => $this->serialize($link->fresh('createdBy'))],
            __('Payment link created.'),
        );
    }

    /**
     * Cancel (invalidate) an unpaid payment link.
     */
    public function cancel(Request $request, int $id, int $linkId)
    {
        $link = $this->resolveLink($id, $linkId);

        try {
            $link = $this->service->cancel($link, (int) $request->user()->id);
        } catch (Throwable $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond(
            ['payment_link' => $this->serialize($link->fresh('createdBy'))],
            __('Payment link cancelled.'),
        );
    }

    /**
     * Approve a manual-transfer slip uploaded against a payment link. This confirms the
     * payment and records the deposit against the appointment.
     */
    public function approveManual(Request $request, int $id, int $linkId)
    {
        $link = $this->resolveLink($id, $linkId);

        if ($link->status !== 'PENDING') {
            return $this->respondError(__('Only a pending payment link can be approved.'), 422);
        }
        if (! $link->manual_slip_path) {
            return $this->respondError(__('No payment slip has been uploaded for this link.'), 422);
        }

        try {
            $link = $this->service->markPaidAndRecordDeposit(
                link: $link,
                provider: 'manual_transfer',
                ref: $link->payment_ref,
                payer: [
                    'customer_id' => $link->payer_customer_id,
                    'name' => $link->payer_name,
                    'phone' => $link->payer_phone,
                    'email' => $link->payer_email,
                ],
                rawContext: ['manual_slip_url' => $link->manual_slip_url, 'approved_by' => (int) $request->user()->id],
            );
        } catch (Throwable $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond(
            ['payment_link' => $this->serialize($link->fresh('createdBy'))],
            __('Payment confirmed and deposit recorded.'),
        );
    }

    /**
     * Reject an uploaded manual-transfer slip and send the link back for re-upload.
     */
    public function rejectProof(Request $request, int $id, int $linkId)
    {
        $link = $this->resolveLink($id, $linkId);

        if ($link->status !== 'PENDING') {
            return $this->respondError(__('Only a pending payment link can be rejected.'), 422);
        }
        if (! $link->manual_slip_path) {
            return $this->respondError(__('No payment slip has been uploaded for this link.'), 422);
        }

        if ($link->manual_slip_path) {
            Storage::disk('public')->delete($link->manual_slip_path);
        }

        $link->update([
            'manual_slip_path' => null,
            'manual_slip_url' => null,
            'manual_review_status' => 'rejected',
        ]);

        return $this->respond(
            ['payment_link' => $this->serialize($link->fresh('createdBy'))],
            __('Payment proof rejected. The customer can upload a new one.'),
        );
    }

    protected function resolveLink(int $bookingId, int $linkId): BookingPaymentLink
    {
        return BookingPaymentLink::query()
            ->where('id', $linkId)
            ->where('booking_id', $bookingId)
            ->firstOrFail();
    }

    /**
     * @return array<string,mixed>
     */
    protected function serializeForReview(BookingPaymentLink $link): array
    {
        $booking = $link->booking;
        $customerName = $booking?->customer?->name ?: $booking?->guest_name ?: null;
        $customerContact = $booking?->customer?->phone
            ?: $booking?->guest_phone
            ?: $booking?->customer?->email
            ?: $booking?->guest_email
            ?: null;

        return array_merge($this->serialize($link), [
            'booking_code' => (string) ($booking?->booking_code ?? ''),
            'service_name' => (string) ($booking?->service?->name ?? 'Service'),
            'staff_name' => (string) ($booking?->staff?->name ?? ''),
            'appointment_start_at' => optional($booking?->start_at)->toDateTimeString(),
            'customer_name' => $customerName,
            'customer_contact' => $customerContact,
            'slip_uploaded_at' => optional($link->updated_at)->toDateTimeString(),
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    protected function serialize(BookingPaymentLink $link): array
    {
        return [
            'id' => (int) $link->id,
            'booking_id' => (int) $link->booking_id,
            'token' => (string) $link->token,
            'purpose' => (string) $link->purpose,
            'amount' => (float) $link->amount,
            'status' => (string) $link->status,
            'url' => $this->service->publicUrl($link),
            'provider' => $link->provider,
            'payment_ref' => $link->payment_ref,
            'order_id' => $link->order_id ? (int) $link->order_id : null,
            'receipt_url' => $link->status === 'PAID' && $link->order_id ? $this->buildReceiptUrl((int) $link->order_id) : null,
            'manual_review_status' => $link->manual_review_status,
            'manual_slip_url' => $link->manual_slip_url,
            'has_slip' => (bool) $link->manual_slip_path,
            'payer' => [
                'name' => $link->payer_name,
                'phone' => $link->payer_phone,
                'email' => $link->payer_email,
            ],
            'paid_at' => optional($link->paid_at)->toDateTimeString(),
            'expires_at' => optional($link->expires_at)->toDateTimeString(),
            'cancelled_at' => optional($link->cancelled_at)->toDateTimeString(),
            'created_at' => optional($link->created_at)->toDateTimeString(),
            'created_by' => $link->createdBy ? ['id' => (int) $link->createdBy->id, 'name' => (string) $link->createdBy->name] : null,
        ];
    }

    /**
     * Public receipt/invoice URL for the deposit order created when the link was paid.
     */
    protected function buildReceiptUrl(int $orderId): ?string
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('order_id', $orderId)
            ->latest('id')
            ->first();

        if (! $receiptToken) {
            $receiptToken = OrderReceiptToken::create([
                'order_id' => $orderId,
                'token' => Str::random(64),
                'expires_at' => null,
            ]);
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');

        return $frontendUrl . '/api/proxy/public/receipt/' . $receiptToken->token . '/invoice';
    }
}
