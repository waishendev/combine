<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use App\Services\StaffBranchAccessService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Copy Staff "Work At" Branch assignments from one Branch to another.
 * Also additively syncs linked login users onto the target Branch.
 */
class CloneBranchStaffAssignmentsCommand extends Command
{
    protected $signature = 'staff-branch:clone-assignments
        {--from-id= : Source Branch store_locations.id}
        {--to-id= : Target Branch store_locations.id}
        {--from-code= : Source Branch code}
        {--to-code= : Target Branch code}
        {--dry-run : Preview only}
        {--force : Apply changes}';

    protected $description = 'Copy Staff Work At assignments from one Branch onto another (does not remove existing)';

    public function handle(StaffBranchAccessService $staffBranchAccess): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        if ($dryRun === $force) {
            $this->error('Provide exactly one of --dry-run or --force.');
            $this->line('Example:');
            $this->line('  php artisan staff-branch:clone-assignments --from-code=PNG --to-code="TESTING BRANCH 2" --dry-run');
            $this->line('  php artisan staff-branch:clone-assignments --from-code=PNG --to-code="TESTING BRANCH 2" --force');

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

        $sourceStaffIds = DB::table('staff_store_location')
            ->where('store_location_id', $from->id)
            ->pluck('staff_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $alreadyOnTarget = DB::table('staff_store_location')
            ->where('store_location_id', $to->id)
            ->whereIn('staff_id', $sourceStaffIds)
            ->pluck('staff_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $alreadyLookup = array_fill_keys($alreadyOnTarget, true);

        $missingStaffIds = $sourceStaffIds
            ->reject(fn (int $id) => isset($alreadyLookup[$id]))
            ->values();

        $this->line("Source: #{$from->id} {$from->name} ({$from->code})");
        $this->line("Target: #{$to->id} {$to->name} ({$to->code})");
        $this->line("Staff on source Branch: {$sourceStaffIds->count()}");
        $this->line('Already on target: '.count($alreadyOnTarget));
        $this->line("Will assign (new): {$missingStaffIds->count()}");
        $this->line('Linked login users will also get target Branch access (additive).');

        if ($dryRun) {
            $this->info('Dry run: zero writes performed.');

            return self::SUCCESS;
        }

        $now = now();
        $assigned = 0;
        $loginSynced = 0;

        DB::transaction(function () use ($to, $missingStaffIds, $now, $staffBranchAccess, &$assigned, &$loginSynced) {
            foreach ($missingStaffIds->chunk(200) as $chunk) {
                $rows = $chunk->map(fn (int $staffId) => [
                    'staff_id' => $staffId,
                    'store_location_id' => (int) $to->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();

                $assigned += DB::table('staff_store_location')->insertOrIgnore($rows);
            }

            $staffs = Staff::query()
                ->whereIn('id', $missingStaffIds->all())
                ->with('admin')
                ->get();

            foreach ($staffs as $staff) {
                $inserted = $staffBranchAccess->synchronize($staff, $staff->admin);
                $loginSynced += count($inserted);
            }
        });

        $this->info("Done. Assigned {$assigned} staff Work At row(s); synced {$loginSynced} login Branch access row(s).");

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
