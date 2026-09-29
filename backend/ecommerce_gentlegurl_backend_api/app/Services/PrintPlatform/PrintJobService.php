<?php

namespace App\Services\PrintPlatform;

use App\Events\PrintJobAvailable;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Models\PrintJobAttempt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PrintJobService
{
    public function createTest(PrintDevice $device, User $actor, ?string $key, ?string $message): PrintJob
    {
        if ($key) {
            $existing = PrintJob::where('created_by_user_id', $actor->id)->where('idempotency_key', $key)->first();
            if ($existing) return $existing;
        }
        $job = DB::transaction(fn () => PrintJob::create([
            'store_location_id' => $device->store_location_id, 'print_device_id' => $device->id,
            'type' => 'test_print', 'status' => 'pending', 'payload_schema_version' => 1,
            'payload' => ['schema_version'=>1,'type'=>'test_print','message'=>$message ?: 'Gentlegurls Print Agent connection test','requested_at'=>now()->toIso8601String()],
            'idempotency_key' => $key, 'available_at' => now(), 'max_attempts' => 3, 'created_by_user_id' => $actor->id,
        ]));
        DB::afterCommit(fn () => $this->notifySafely($job, 'created'));
        return $job;
    }

    public function claimNext(PrintDevice $device): ?array
    {
        return DB::transaction(function () use ($device) {
            $this->releaseExpired($device);
            PrintJob::query()->where('print_device_id', $device->id)->where('status', 'retry_wait')->where('available_at', '<=', now())->update(['status' => 'pending']);
            $job = PrintJob::query()->where('print_device_id', $device->id)->where('status', 'pending')
                ->where('available_at', '<=', now())->orderBy('priority')->orderBy('created_at')->lock('for update skip locked')->first();
            if (! $job) return null;
            $token = Str::random(64); $claimId = (string) Str::uuid(); $attempt = $job->attempt_count + 1; $lease = now()->addMinutes(2);
            $job->update(['status'=>'claimed','attempt_count'=>$attempt,'claim_token_hash'=>hash('sha256',$token),'claimed_at'=>now(),'lease_expires_at'=>$lease]);
            PrintJobAttempt::create(['print_job_id'=>$job->id,'print_device_id'=>$device->id,'claim_id'=>$claimId,'attempt_number'=>$attempt,'status'=>'claimed','claimed_at'=>now(),'lease_expires_at'=>$lease]);
            return ['job'=>$job->fresh(),'claim_id'=>$claimId,'claim_token'=>$token];
        });
    }

    public function transition(PrintDevice $device, PrintJob $job, string $claimId, string $token, string $target, array $result = []): PrintJob
    {
        abort_unless($job->print_device_id === $device->id, 404);
        return DB::transaction(function () use ($job,$claimId,$token,$target,$result) {
            $job = PrintJob::lockForUpdate()->findOrFail($job->id);
            $attempt = PrintJobAttempt::where('print_job_id',$job->id)->where('claim_id',$claimId)->lockForUpdate()->firstOrFail();
            if (in_array($job->status, ['succeeded','failed','cancelled'], true)) return $job;
            abort_unless(hash_equals((string)$job->claim_token_hash, hash('sha256',$token)), 409, 'Invalid or stale claim.');
            if ($target === 'processing') {
                abort_unless($job->status === 'claimed', 409); $job->update(['status'=>'processing','processing_at'=>now()]); $attempt->update(['status'=>'processing','started_at'=>now()]);
            } elseif ($target === 'succeeded') {
                abort_unless(in_array($job->status,['claimed','processing'],true),409); $job->update(['status'=>'succeeded','completed_at'=>now(),'claim_token_hash'=>null,'lease_expires_at'=>null]); $attempt->update(['status'=>'succeeded','finished_at'=>now(),'result_code'=>$result['result_code'] ?? 'simulated']);
            } else {
                abort_unless(in_array($job->status,['claimed','processing'],true),409); $retry = ($result['retryable'] ?? true) && $job->attempt_count < $job->max_attempts;
                $job->update(['status'=>$retry?'retry_wait':'failed','available_at'=>$retry?now()->addSeconds([5,30,120][min(2,$job->attempt_count-1)]):$job->available_at,'failed_at'=>$retry?null:now(),'last_error_code'=>$result['error_code']??'agent_error','last_error_message'=>Str::limit($result['message']??'Agent reported failure',2000),'claim_token_hash'=>null,'lease_expires_at'=>null]);
                $attempt->update(['status'=>$retry?'retry_wait':'failed','finished_at'=>now(),'result_code'=>$result['error_code']??'agent_error','error_message'=>Str::limit($result['message']??'',2000)]);
            }
            return $job->fresh();
        });
    }

    public function releaseExpired(PrintDevice $device): int
    {
        $jobs = PrintJob::where('print_device_id',$device->id)->whereIn('status',['claimed','processing'])->where('lease_expires_at','<',now())->get();
        foreach ($jobs as $job) {
            $retry = $job->attempt_count < $job->max_attempts;
            $job->update(['status'=>$retry?'pending':'failed','available_at'=>now(),'failed_at'=>$retry?null:now(),'last_error_code'=>'lease_expired','last_error_message'=>'Device claim lease expired.','claim_token_hash'=>null,'lease_expires_at'=>null]);
            $job->attempts()->whereNull('finished_at')->update(['status'=>$retry?'lease_expired':'failed','finished_at'=>now(),'result_code'=>'lease_expired']);
        }
        return $jobs->count();
    }

    public function manualRetry(PrintJob $source, User $actor): PrintJob
    {
        if (!in_array($source->status,['failed','cancelled'],true)) throw ValidationException::withMessages(['job'=>['Only terminal jobs can be manually retried.']]);
        $job = PrintJob::create(array_merge($source->only(['store_location_id','print_device_id','printer_id','type','payload_schema_version','payload','source_type','source_id','priority','max_attempts']), ['status'=>'pending','available_at'=>now(),'attempt_count'=>0,'created_by_user_id'=>$actor->id,'manually_retried_from_job_id'=>$source->id]));
        DB::afterCommit(fn()=> $this->notifySafely($job,'manual_retry'));
        return $job;
    }

    private function notifySafely(PrintJob $job, string $reason): void
    {
        try { event(new PrintJobAvailable($job, $reason)); }
        catch (\Throwable $e) { Log::warning('Print job wake-up broadcast failed; reconciliation remains authoritative.', ['print_job_id'=>$job->id,'exception'=>$e::class]); }
    }
}
