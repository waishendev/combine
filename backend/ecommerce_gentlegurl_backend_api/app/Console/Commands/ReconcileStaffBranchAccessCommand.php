<?php

namespace App\Console\Commands;

use App\Models\Staff;
use App\Services\StaffBranchAccessService;
use Illuminate\Console\Command;

class ReconcileStaffBranchAccessCommand extends Command
{
    protected $signature = 'staff-branch-access:reconcile {--dry-run : Report without writing (the default)} {--force : Add missing canonical access rows}';

    protected $description = 'Report and add missing User Branch access derived from Staff Work At assignments';

    public function handle(StaffBranchAccessService $access): int
    {
        if ($this->option('dry-run') && $this->option('force')) {
            $this->error('Choose either --dry-run or --force.');
            return self::INVALID;
        }

        $write = (bool) $this->option('force');
        $rows = [];
        $added = 0;

        Staff::query()->whereHas('admin')->with(['admin.storeLocations:id', 'storeLocations:id,name'])
            ->orderBy('id')->each(function (Staff $staff) use ($access, $write, &$rows, &$added) {
                $assigned = $staff->storeLocations->pluck('id')->map(fn ($id) => (int) $id)->sort()->values();
                $userAccess = $staff->admin->storeLocations->pluck('id')->map(fn ($id) => (int) $id)->sort()->values();
                $missing = $assigned->diff($userAccess)->values();
                $extra = $userAccess->diff($assigned)->values();

                if ($write && $missing->isNotEmpty()) {
                    $added += count($access->synchronize($staff, $staff->admin));
                }

                if ($missing->isNotEmpty() || $extra->isNotEmpty()) {
                    $rows[] = [
                        $staff->id,
                        $staff->name,
                        $staff->admin->id,
                        $assigned->implode(','),
                        $missing->implode(','),
                        $extra->implode(','),
                        $write ? $missing->count() : 0,
                        $extra->isNotEmpty() ? 'preserved (source ambiguous)' : '-',
                    ];
                }
            });

        $this->table(
            ['Staff ID', 'Staff name', 'User ID', 'Work At IDs', 'Missing access', 'Extra access', 'Rows added', 'Extra policy'],
            $rows,
        );
        $this->info($write ? "Added {$added} missing access row(s)." : 'Dry run: zero rows written. Use --force to add missing access.');

        return self::SUCCESS;
    }
}
