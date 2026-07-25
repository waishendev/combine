<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Services\SettingService;
use Carbon\Carbon;

class WalletTopupReserveService
{
    public const ECOMMERCE_SETTING_KEY = 'ecommerce.wallet_topup_reserve_minutes';

    public const BOOKING_SETTING_KEY = 'booking.wallet_topup_reserve_minutes';

    public function getReserveMinutes(string $workspaceType = 'ecommerce'): int
    {
        $workspace = in_array($workspaceType, ['ecommerce', 'booking'], true)
            ? $workspaceType
            : 'ecommerce';

        $key = $workspace === 'booking'
            ? self::BOOKING_SETTING_KEY
            : self::ECOMMERCE_SETTING_KEY;

        return $this->resolvePositiveMinutes(
            SettingService::get($key, 30, $workspace),
            30,
        );
    }

    public function getReserveMinutesForTopup(CustomerWalletTransaction $topup): int
    {
        $workspace = in_array((string) $topup->workspace_type, ['ecommerce', 'booking'], true)
            ? (string) $topup->workspace_type
            : 'ecommerce';

        return $this->getReserveMinutes($workspace);
    }

    public function getReserveExpiresAt(CustomerWalletTransaction $topup): Carbon
    {
        $base = $topup->created_at?->copy() ?? Carbon::now();

        return $base->addMinutes($this->getReserveMinutesForTopup($topup));
    }

    public function isExpired(CustomerWalletTransaction $topup): bool
    {
        return $this->getReserveExpiresAt($topup)->isPast();
    }

    /**
     * Top-ups that still need payment / proof upload are subject to the reserve window.
     * Once proof is uploaded (waiting verification), the window no longer applies.
     */
    public function isSubjectToReserve(CustomerWalletTransaction $topup): bool
    {
        if ($topup->type !== CustomerWalletTransaction::TYPE_TOPUP) {
            return false;
        }

        if (! in_array($topup->status, [
            CustomerWalletTransaction::STATUS_PENDING,
            CustomerWalletTransaction::STATUS_PENDING_PAYMENT,
            CustomerWalletTransaction::STATUS_PENDING_PROOF,
        ], true)) {
            return false;
        }

        $metadata = is_array($topup->metadata) ? $topup->metadata : [];
        $proofUrl = trim((string) ($metadata['payment_proof_url'] ?? ''));

        return $proofUrl === '';
    }

    /**
     * If the top-up is past the payment window, mark it expired and return true.
     */
    public function expireIfNeeded(CustomerWalletTransaction $topup, CustomerWalletService $wallet): bool
    {
        if (! $this->isSubjectToReserve($topup) || ! $this->isExpired($topup)) {
            return false;
        }

        $wallet->markFailed(
            $topup,
            'Expired: wallet top-up payment window elapsed.',
            null,
            CustomerWalletTransaction::STATUS_EXPIRED,
        );

        return true;
    }

    private function resolvePositiveMinutes(mixed $value, int $fallback): int
    {
        if (is_array($value)) {
            $value = data_get($value, 'minutes', data_get($value, 'value', $fallback));
        }

        $minutes = (int) $value;

        return $minutes > 0 ? $minutes : $fallback;
    }
}
