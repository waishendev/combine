<?php

namespace App\Console\Commands;

use App\Models\Booking\BookingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MigrateBookingServiceCategoriesCommand extends Command
{
    protected $signature = 'booking:migrate-service-categories
        {--dry-run : Preview changes without writing to the pivot table}';

    protected $description = 'Merge booking_services.category_id into booking_service_category_service (supports multiple categories per service)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $hasCategoryIdColumn = Schema::hasColumn('booking_services', 'category_id');
        $hasPivotTable = Schema::hasTable('booking_service_category_service');

        if (! $hasPivotTable) {
            $this->error('Pivot table booking_service_category_service does not exist. Run migrations first.');

            return self::FAILURE;
        }

        if (! $hasCategoryIdColumn) {
            $this->info('booking_services.category_id column is not present — nothing to migrate.');
            $this->line('Pivot table booking_service_category_service is already the source of truth.');

            return self::SUCCESS;
        }

        $services = BookingService::query()->orderBy('id')->get(['id', 'name', 'cn_name', 'category_id']);
        $pivotRows = DB::table('booking_service_category_service')
            ->select('booking_service_id', 'booking_service_category_id')
            ->orderBy('booking_service_id')
            ->orderBy('booking_service_category_id')
            ->get()
            ->groupBy('booking_service_id');

        $wouldSync = 0;
        $unchanged = 0;
        $rows = [];

        $run = function () use ($services, $pivotRows, $dryRun, &$wouldSync, &$unchanged, &$rows) {
            foreach ($services as $service) {
                $serviceId = (int) $service->id;
                $currentPivotIds = collect($pivotRows->get($serviceId, collect()))
                    ->pluck('booking_service_category_id')
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->unique()
                    ->sort()
                    ->values();

                $columnCategoryId = $service->category_id ? (int) $service->category_id : null;
                $targetIds = $currentPivotIds
                    ->when($columnCategoryId, fn ($ids) => $ids->push($columnCategoryId))
                    ->unique()
                    ->sort()
                    ->values();

                if ($targetIds->isEmpty()) {
                    $unchanged++;

                    continue;
                }

                if ($targetIds->values()->all() === $currentPivotIds->values()->all()) {
                    $unchanged++;

                    continue;
                }

                $addedIds = $targetIds->diff($currentPivotIds)->values();
                $rows[] = [
                    'service_id' => $serviceId,
                    'service_name' => (string) $service->name,
                    'current_pivot' => $currentPivotIds->isEmpty() ? '-' : $currentPivotIds->implode(', '),
                    'category_id_column' => $columnCategoryId ? (string) $columnCategoryId : '-',
                    'target_pivot' => $targetIds->implode(', '),
                    'added' => $addedIds->isEmpty() ? '-' : $addedIds->implode(', '),
                ];

                if (! $dryRun) {
                    $service->categories()->sync($targetIds->all());
                }

                $wouldSync++;
            }
        };

        if ($dryRun) {
            $run();
        } else {
            DB::transaction($run);
        }

        $this->newLine();
        $this->info($dryRun ? 'Dry run complete. No changes were saved.' : 'Category migration complete.');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total booking services scanned', $services->count()],
                [$dryRun ? 'Would sync pivot rows' : 'Synced pivot rows', $wouldSync],
                ['Already correct / no categories', $unchanged],
            ],
        );

        if (count($rows) > 0) {
            $this->newLine();
            $this->warn($dryRun ? 'Services that would be updated:' : 'Services updated:');
            $this->table(
                ['Service ID', 'Name', 'Current Pivot', 'category_id Column', 'Target Pivot', 'Added IDs'],
                collect($rows)->map(fn (array $row) => [
                    $row['service_id'],
                    $row['service_name'],
                    $row['current_pivot'],
                    $row['category_id_column'],
                    $row['target_pivot'],
                    $row['added'],
                ])->all(),
            );
        }

        if ($dryRun && $wouldSync > 0) {
            $this->newLine();
            $this->line('Run without --dry-run to apply, then run migrations to drop booking_services.category_id.');
        }

        return self::SUCCESS;
    }
}
