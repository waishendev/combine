<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\BranchNotificationSetting;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;

class InitializeBranchEmailSettings extends Command
{
    protected $signature = 'branch-email-settings:initialize {--dry-run} {--force}';
    protected $description = 'Preview or initialize persisted notification settings for every Branch';

    public function handle(): int
    {
        if (! $this->option('dry-run') && ! $this->option('force')) {
            $this->error('Choose --dry-run to preview or --force to initialize.');
            return self::INVALID;
        }

        $rows = [];
        foreach (StoreLocation::query()->orderBy('sort_order')->orderBy('id')->get() as $branch) {
            $existing = BranchNotificationSetting::query()->where('store_location_id', $branch->id)->first();
            $status = $existing ? 'already configured — skipped' : ($this->option('force') ? 'initialized' : 'would initialize');
            if (! $existing && $this->option('force')) {
                BranchNotificationSetting::query()->create(['store_location_id' => $branch->id] + BranchNotificationSetting::initialValues());
            }
            $rows[] = [$branch->id, $branch->name, $status, $existing ? implode(', ', $existing->booking_payment_proof_recipients ?? []) : BranchNotificationSetting::INITIAL_RECIPIENT];
        }
        $this->table(['ID', 'Branch', 'Result', 'Booking proof recipients'], $rows);
        return self::SUCCESS;
    }
}
