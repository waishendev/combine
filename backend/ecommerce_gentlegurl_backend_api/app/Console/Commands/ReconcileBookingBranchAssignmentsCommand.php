<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileBookingBranchAssignmentsCommand extends Command
{
    protected $signature = 'booking-service-staff-branch:reconcile {--dry-run : Report without writing} {--force : Apply deterministic assignments only}';

    protected $description = 'Report legacy Booking branch assignments and optionally apply only deterministic repairs';

    public function handle(): int
    {
        $write = (bool) $this->option('force') && ! $this->option('dry-run');
        $summary = ['deterministic' => 0, 'ambiguous' => 0, 'invalid' => 0, 'unresolved' => 0, 'linked_products' => 0];

        DB::table('booking_service_staff')->whereNull('store_location_id')->orderBy('id')->get()->each(
            function ($row) use (&$summary, $write): void {
                $serviceBranches = DB::table('booking_service_store_location')->where('booking_service_id', $row->service_id)->pluck('store_location_id');
                $staffBranches = DB::table('staff_store_location')->where('staff_id', $row->staff_id)->pluck('store_location_id');
                $eligible = $serviceBranches->intersect($staffBranches)->unique()->values();
                if ($eligible->count() === 1 && $serviceBranches->count() === 1) {
                    $summary['deterministic']++;
                    if ($write) {
                        DB::table('booking_service_staff')->where('id', $row->id)->update(['store_location_id' => $eligible->first(), 'updated_at' => now()]);
                    }
                } elseif ($eligible->isEmpty()) {
                    $summary[$serviceBranches->isEmpty() || $staffBranches->isEmpty() ? 'unresolved' : 'invalid']++;
                } else {
                    $summary['ambiguous']++;
                }
            }
        );

        DB::table('booking_services')->whereNotNull('linked_booking_product_id')->orderBy('id')->get()->each(
            function ($service) use (&$summary, $write): void {
                $ids = DB::table('booking_service_store_location')->where('booking_service_id', $service->id)->pluck('store_location_id')->all();
                $summary['linked_products']++;
                if ($write) {
                    DB::table('booking_product_store_location')->where('booking_product_id', $service->linked_booking_product_id)->delete();
                    foreach ($ids as $id) {
                        DB::table('booking_product_store_location')->insert([
                            'booking_product_id' => $service->linked_booking_product_id,
                            'store_location_id' => $id,
                            'created_at' => now(), 'updated_at' => now(),
                        ]);
                    }
                }
            }
        );

        $this->table(['deterministic', 'ambiguous', 'invalid', 'unresolved legacy', 'linked products'], [[...array_values($summary)]]);
        $this->info($write ? 'Deterministic assignments applied.' : 'Dry run only; pass --force to apply deterministic assignments.');

        return self::SUCCESS;
    }
}
