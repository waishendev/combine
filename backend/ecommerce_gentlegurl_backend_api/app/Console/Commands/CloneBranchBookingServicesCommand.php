<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Clone Booking Service Branch availability + allowed staff from one Branch to another.
 */
class CloneBranchBookingServicesCommand extends Command
{
    protected $signature = 'booking-service-branch:clone
        {--from-id= : Source Branch store_locations.id}
        {--to-id= : Target Branch store_locations.id}
        {--from-code= : Source Branch code}
        {--to-code= : Target Branch code}
        {--dry-run : Preview only}
        {--force : Apply changes}';

    protected $description = 'Copy Booking Services + allowed staff from one Branch onto another (additive; does not remove existing)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        if ($dryRun === $force) {
            $this->error('Provide exactly one of --dry-run or --force.');
            $this->line('Example:');
            $this->line('  php artisan booking-service-branch:clone --from-code=PNG --to-code="TESTING BRANCH 2" --dry-run');
            $this->line('  php artisan booking-service-branch:clone --from-code=PNG --to-code="TESTING BRANCH 2" --force');

            return self::FAILURE;
        }

        $from = $this->resolveBranch($this->option('from-id'), $this->option('from-code'), 'source');
        $to = $this->resolveBranch($this->option('to-id'), $this->option('to-code'), 'target');
        if (! $from || ! $to) {
            return self::FAILURE;
        }
        if ((int) $from->id === (int) $to->id) {
            $this->error('Source and target Branch must be different.');

            return self::FAILURE;
        }

        $fromId = (int) $from->id;
        $toId = (int) $to->id;

        $sourceServiceIds = DB::table('booking_service_store_location')
            ->where('store_location_id', $fromId)
            ->pluck('booking_service_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $alreadyServiceIds = DB::table('booking_service_store_location')
            ->where('store_location_id', $toId)
            ->whereIn('booking_service_id', $sourceServiceIds)
            ->pluck('booking_service_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $alreadyServiceLookup = array_fill_keys($alreadyServiceIds, true);

        $missingServiceIds = $sourceServiceIds
            ->reject(fn (int $id) => isset($alreadyServiceLookup[$id]))
            ->values();

        $sourceStaffLinks = DB::table('booking_service_staff')
            ->where('store_location_id', $fromId)
            ->where('is_active', true)
            ->whereIn('service_id', $sourceServiceIds)
            ->get(['service_id', 'staff_id', 'is_active']);

        $staffOnTargetLookup = array_fill_keys(
            DB::table('staff_store_location')
                ->where('store_location_id', $toId)
                ->pluck('staff_id')
                ->map(fn ($id) => (int) $id)
                ->all(),
            true,
        );

        $existingTargetStaffLinks = DB::table('booking_service_staff')
            ->where('store_location_id', $toId)
            ->get(['service_id', 'staff_id', 'is_active'])
            ->keyBy(fn ($row) => ((int) $row->service_id).':'.((int) $row->staff_id));

        $staffLinksToInsert = [];
        $staffIdsToReactivate = [];
        $skippedMissingStaff = 0;
        $skippedAlreadyActive = 0;

        foreach ($sourceStaffLinks as $link) {
            $serviceId = (int) $link->service_id;
            $staffId = (int) $link->staff_id;
            $key = $serviceId.':'.$staffId;

            if (! isset($staffOnTargetLookup[$staffId])) {
                $skippedMissingStaff++;
                continue;
            }

            $existing = $existingTargetStaffLinks->get($key);
            if ($existing) {
                if ((bool) $existing->is_active) {
                    $skippedAlreadyActive++;
                } else {
                    $staffIdsToReactivate[] = [(int) $existing->service_id, (int) $existing->staff_id];
                }
                continue;
            }

            $staffLinksToInsert[] = [
                'service_id' => $serviceId,
                'staff_id' => $staffId,
                'store_location_id' => $toId,
                'is_active' => true,
            ];
            $existingTargetStaffLinks[$key] = (object) ['service_id' => $serviceId, 'staff_id' => $staffId, 'is_active' => true];
        }

        $this->line("Source: #{$from->id} {$from->name} ({$from->code})");
        $this->line("Target: #{$to->id} {$to->name} ({$to->code})");
        $this->line("Services on source: {$sourceServiceIds->count()}");
        $this->line('Services already on target: '.count($alreadyServiceIds));
        $this->line("Services to assign: {$missingServiceIds->count()}");
        $this->line("Allowed-staff links on source: {$sourceStaffLinks->count()}");
        $this->line('Allowed-staff links to insert: '.count($staffLinksToInsert));
        $this->line('Allowed-staff links to reactivate: '.count($staffIdsToReactivate));
        $this->line("Skipped (staff not Work At target): {$skippedMissingStaff}");
        $this->line("Skipped (already active on target): {$skippedAlreadyActive}");

        if ($dryRun) {
            $this->info('Dry run: zero writes performed.');

            return self::SUCCESS;
        }

        $now = now();
        $servicesAssigned = 0;
        $staffAssigned = 0;
        $reactivated = 0;

        DB::transaction(function () use (
            $toId,
            $missingServiceIds,
            $staffLinksToInsert,
            $staffIdsToReactivate,
            $now,
            &$servicesAssigned,
            &$staffAssigned,
            &$reactivated,
        ) {
            foreach ($missingServiceIds->chunk(200) as $chunk) {
                $rows = $chunk->map(fn (int $serviceId) => [
                    'booking_service_id' => $serviceId,
                    'store_location_id' => $toId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();

                $servicesAssigned += DB::table('booking_service_store_location')->insertOrIgnore($rows);
            }

            foreach (array_chunk($staffLinksToInsert, 200) as $chunk) {
                $rows = array_map(static fn (array $row) => $row + [
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk);

                $staffAssigned += DB::table('booking_service_staff')->insertOrIgnore($rows);
            }

            foreach ($staffIdsToReactivate as [$serviceId, $staffId]) {
                $reactivated += DB::table('booking_service_staff')
                    ->where('store_location_id', $toId)
                    ->where('service_id', $serviceId)
                    ->where('staff_id', $staffId)
                    ->where('is_active', false)
                    ->update([
                        'is_active' => true,
                        'updated_at' => $now,
                    ]);
            }
        });

        $this->info("Done. Assigned {$servicesAssigned} service Branch row(s); inserted {$staffAssigned} allowed-staff row(s); reactivated {$reactivated}.");

        return self::SUCCESS;
    }

    private function resolveBranch(mixed $idOption, mixed $codeOption, string $label): ?StoreLocation
    {
        $id = (int) ($idOption ?? 0);
        $code = trim((string) ($codeOption ?? ''));

        if ($id <= 0 && $code === '') {
            $this->error("Provide {$label} via --from-id/--to-id or --from-code/--to-code.");

            return null;
        }

        $branch = $id > 0
            ? StoreLocation::query()->find($id)
            : StoreLocation::query()->where('code', $code)->first();

        if (! $branch) {
            $this->error("{$label} Branch not found.");

            return null;
        }

        if (! $branch->is_active) {
            $this->error("{$label} Branch #{$branch->id} ({$branch->code}) is inactive.");

            return null;
        }

        return $branch;
    }
}
