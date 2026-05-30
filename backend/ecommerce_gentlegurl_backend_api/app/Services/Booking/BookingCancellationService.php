<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;

class BookingCancellationService
{
    public function __construct(
        protected CustomerServicePackageService $customerServicePackageService,
    ) {
    }

    /**
     * Cancel an unpaid/non-finalized booking and release any reserved package claims.
     *
     * @param array<int, string> $allowedStatuses
     * @param array<string, mixed> $meta
     */
    public function cancel(
        Booking $booking,
        ?int $actorId,
        ?string $reason = null,
        string $actorType = 'ADMIN',
        array $allowedStatuses = ['HOLD', 'CONFIRMED', 'PENDING'],
        array $meta = []
    ): Booking {
        $previousStatus = (string) $booking->status;

        if (! in_array($previousStatus, $allowedStatuses, true)) {
            throw new \RuntimeException('This booking cannot be cancelled from its current status.');
        }

        $booking->status = 'CANCELLED';
        $booking->cancelled_at = now();
        $booking->cancellation_type = 'CANCELLED';

        $trimmedReason = trim((string) $reason);
        if ($trimmedReason !== '') {
            $booking->notes = trim(($booking->notes ? $booking->notes . "\n" : '') . 'Cancellation reason: ' . $trimmedReason);
        }

        $booking->save();

        $releasedClaims = $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);
        $releasedClaims += $this->customerServicePackageService->releaseReservedClaimsBySource('POS', (int) $booking->id);

        BookingLog::create([
            'booking_id' => $booking->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'action' => 'CANCELLED',
            'meta' => array_merge([
                'previous_status' => $previousStatus,
                'new_status' => 'CANCELLED',
                'reason' => $trimmedReason !== '' ? $trimmedReason : null,
                'released_package_claims' => $releasedClaims,
            ], $meta),
            'created_at' => now(),
        ]);

        return $booking;
    }
}
