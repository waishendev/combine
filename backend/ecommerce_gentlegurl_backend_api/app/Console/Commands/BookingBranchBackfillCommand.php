<?php

namespace App\Console\Commands;

use App\Models\Booking\BookingService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use Illuminate\Console\Command;

class BookingBranchBackfillCommand extends Command
{
    protected $signature = 'booking-branch:backfill {--store-code= : Existing active Branch code} {--dry-run : Report without writing} {--force : Apply missing assignments}';
    protected $description = 'Add legacy Staff and Booking Service assignments to an explicitly selected Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') {
            $this->error('--store-code is required.');
            return self::INVALID;
        }
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::INVALID;
        }

        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            $this->error("Active Branch code [{$code}] was not found. No writes performed.");
            return self::FAILURE;
        }

        $staffTotal = Staff::query()->count();
        $staffAssigned = Staff::query()->whereHas('storeLocations', fn ($q) => $q->whereKey($branch->id))->count();
        $serviceTotal = BookingService::query()->count();
        $serviceAssigned = BookingService::query()->whereHas('storeLocations', fn ($q) => $q->whereKey($branch->id))->count();

        $this->table(['Record type', 'Total', 'Already assigned', 'Missing'], [
            ['Staff', $staffTotal, $staffAssigned, $staffTotal - $staffAssigned],
            ['Booking Services', $serviceTotal, $serviceAssigned, $serviceTotal - $serviceAssigned],
            ['Invalid/unresolved', 0, 0, 0],
        ]);

        if ($this->option('dry-run')) {
            $this->info('Dry run complete. Zero writes performed.');
            return self::SUCCESS;
        }

        Staff::query()->whereDoesntHave('storeLocations', fn ($q) => $q->whereKey($branch->id))
            ->eachById(fn (Staff $staff) => $staff->storeLocations()->syncWithoutDetaching([$branch->id]));
        BookingService::query()->whereDoesntHave('storeLocations', fn ($q) => $q->whereKey($branch->id))
            ->eachById(fn (BookingService $service) => $service->storeLocations()->syncWithoutDetaching([$branch->id]));

        $this->info(sprintf('Applied %d Staff and %d Booking Service assignments; existing assignments were preserved.', $staffTotal - $staffAssigned, $serviceTotal - $serviceAssigned));
        return self::SUCCESS;
    }
}
