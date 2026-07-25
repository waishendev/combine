<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Services\Ecommerce\CustomerWalletService;
use App\Services\Ecommerce\WalletTopupReserveService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireWalletTopups extends Command
{
    protected $signature = 'wallet:expire-pending-topups';

    protected $description = 'Expire unpaid / unproven wallet top-ups past the reserve window.';

    public function __construct(
        protected WalletTopupReserveService $reserveService,
        protected CustomerWalletService $walletService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $expiredCount = 0;

        CustomerWalletTransaction::query()
            ->where('type', CustomerWalletTransaction::TYPE_TOPUP)
            ->whereIn('status', [
                CustomerWalletTransaction::STATUS_PENDING,
                CustomerWalletTransaction::STATUS_PENDING_PAYMENT,
                CustomerWalletTransaction::STATUS_PENDING_PROOF,
            ])
            ->orderBy('id')
            ->chunkById(50, function ($topups) use (&$expiredCount) {
                foreach ($topups as $topup) {
                    DB::transaction(function () use ($topup, &$expiredCount) {
                        $locked = CustomerWalletTransaction::query()
                            ->where('id', $topup->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $locked) {
                            return;
                        }

                        if (! $this->reserveService->isSubjectToReserve($locked)) {
                            return;
                        }

                        if (! $this->reserveService->isExpired($locked)) {
                            return;
                        }

                        $this->walletService->markFailed(
                            $locked,
                            'Expired: wallet top-up payment window elapsed.',
                            null,
                            CustomerWalletTransaction::STATUS_EXPIRED,
                        );
                        $expiredCount++;
                    });
                }
            });

        $this->info('Expired wallet top-ups: '.$expiredCount);

        return self::SUCCESS;
    }
}
