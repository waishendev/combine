<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillLeaveBranchesCommand extends Command
{
    protected $signature = 'leave-branch:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Attribute NULL legacy Leave Requests and their approved Time-Off records to one explicit Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '' || ((bool) $this->option('dry-run') === (bool) $this->option('force'))) {
            $this->error('Provide --store-code and exactly one of --dry-run or --force.'); return self::INVALID;
        }
        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) { $this->error("Branch code [{$code}] was not found. No writes performed."); return self::FAILURE; }
        $pending = DB::table('booking_leave_requests')->whereNull('store_location_id')->count();
        $attributed = DB::table('booking_leave_requests')->whereNotNull('store_location_id')->count();
        $timeoffs = DB::table('booking_staff_timeoffs')->whereNull('store_location_id')->whereIn('id', DB::table('booking_leave_requests')->whereNull('store_location_id')->whereNotNull('approved_timeoff_id')->select('approved_timeoff_id'))->count();
        $this->table(['Target ID', 'Code', 'Name', 'NULL requests', 'Already attributed', 'Linked time-offs', 'Unsafe'], [[$branch->id, $branch->code, $branch->name, $pending, $attributed, $timeoffs, 0]]);
        if ($this->option('dry-run')) { $this->info('Dry run complete. Zero writes performed.'); return self::SUCCESS; }
        DB::transaction(function () use ($branch) {
            DB::table('booking_staff_timeoffs')->whereNull('store_location_id')->whereIn('id', DB::table('booking_leave_requests')->whereNull('store_location_id')->whereNotNull('approved_timeoff_id')->select('approved_timeoff_id'))->update(['store_location_id' => $branch->id, 'updated_at' => now()]);
            DB::table('booking_leave_requests')->whereNull('store_location_id')->update(['store_location_id' => $branch->id, 'updated_at' => now()]);
        });
        $this->info("Updated {$pending} NULL Leave Request(s) and {$timeoffs} linked Time-Off record(s); attributed rows were preserved.");
        return self::SUCCESS;
    }
}
