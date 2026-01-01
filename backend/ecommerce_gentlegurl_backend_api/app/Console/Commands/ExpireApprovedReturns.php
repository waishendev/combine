<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\ReturnRequest;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ExpireApprovedReturns extends Command
{
    protected $signature = 'ecommerce:expire-approved-returns';

    protected $description = 'Cancel approved returns that missed the tracking submission window.';

    public function handle(): int
    {
        $trackingWindowDays = (int) SettingService::get('ecommerce.return_tracking_submit_days', 7);
        $cutoff = Carbon::now()->subDays($trackingWindowDays);

        $returns = ReturnRequest::query()
            ->where('status', 'approved')
            ->whereNull('return_shipped_at')
            ->whereNotNull('reviewed_at')
            ->where('reviewed_at', '<=', $cutoff)
            ->get();

        $updated = 0;

        foreach ($returns as $returnRequest) {
            $returnRequest->update([
                'status' => 'cancelled',
                'admin_note' => $returnRequest->admin_note ?: 'Cancelled (No tracking submitted).',
            ]);
            $updated++;
        }

        $this->info("Cancelled {$updated} approved returns.");

        return self::SUCCESS;
    }
}
