<?php
namespace App\Console\Commands;
use App\Models\PrintDevice;
use App\Services\PrintPlatform\PrintJobService;
use Illuminate\Console\Command;
class ReleaseExpiredPrintJobClaims extends Command
{
    protected $signature='print-jobs:release-expired-claims';
    protected $description='Release expired Phase 1 print-job leases for safe simulated retry';
    public function handle(PrintJobService $jobs): int { $count=0; foreach (PrintDevice::whereHas('jobs',fn($q)=>$q->whereIn('status',['claimed','processing'])->where('lease_expires_at','<',now()))->cursor() as $device) { $count += $jobs->releaseExpired($device); } $this->info("Released {$count} expired claims."); return self::SUCCESS; }
}
