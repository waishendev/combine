<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Models\User;
use App\Services\PrintPlatform\PairingService;
use App\Services\PrintPlatform\PrintJobService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PrintPlatformWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function branch(): StoreLocation
    {
        return StoreLocation::create(['name'=>'Print Test Branch','code'=>'PRINT-TEST','address_line1'=>'1 Test Road','city'=>'George Town','state'=>'Penang','postcode'=>'10000','country'=>'Malaysia','is_active'=>true]);
    }

    private function device(?StoreLocation $branch = null): PrintDevice
    {
        return PrintDevice::create(['uuid'=>(string)\Illuminate\Support\Str::uuid(),'store_location_id'=>($branch ?? $this->branch())->id,'name'=>'GT-POS-01','status'=>'active']);
    }

    public function test_pairing_is_one_time_and_issues_device_token(): void
    {
        $user=User::factory()->create(); $device=$this->device(); $service=app(PairingService::class); $code=$service->issue($device,$user);
        $result=$service->pair($code,['device_name'=>'GT-POS-01','installation_id'=>'installation-1','app_version'=>'1.0'],'127.0.0.1');
        $this->assertNotEmpty($result['token']); $this->assertSame($device->id,$result['device']->id); $this->assertDatabaseCount('personal_access_tokens',1);
        $this->expectException(ValidationException::class); $service->pair($code,['device_name'=>'GT-POS-01','installation_id'=>'installation-1'],'127.0.0.1');
    }

    public function test_expired_pairing_code_is_rejected(): void
    {
        $user=User::factory()->create();$device=$this->device();$service=app(PairingService::class);$code=$service->issue($device,$user);$device->pairingCodes()->update(['expires_at'=>now()->subMinute()]);
        $this->expectException(ValidationException::class);$service->pair($code,['device_name'=>'GT-POS-01','installation_id'=>'installation-1'],'127.0.0.1');
    }

    public function test_test_job_is_idempotent_and_claim_ack_is_idempotent(): void
    {
        Event::fake();$user=User::factory()->create();$device=$this->device();$service=app(PrintJobService::class);
        $first=$service->createTest($device,$user,'same-request','Hello');$second=$service->createTest($device,$user,'same-request','Hello');$this->assertSame($first->id,$second->id);$this->assertDatabaseCount('print_jobs',1);
        $claim=$service->claimNext($device);$this->assertSame('claimed',$claim['job']->status);
        $processing=$service->transition($device,$first,$claim['claim_id'],$claim['claim_token'],'processing');$this->assertSame('processing',$processing->status);
        $done=$service->transition($device,$first,$claim['claim_id'],$claim['claim_token'],'succeeded',['result_code'=>'simulated']);$this->assertSame('succeeded',$done->status);
        $duplicate=$service->transition($device,$first,$claim['claim_id'],$claim['claim_token'],'succeeded');$this->assertSame('succeeded',$duplicate->status);
    }

    public function test_failure_retries_then_terminal_failure_and_manual_retry(): void
    {
        Event::fake();$user=User::factory()->create();$device=$this->device();$service=app(PrintJobService::class);$job=$service->createTest($device,$user,null,null);
        foreach(range(1,3) as $attempt){$claim=$service->claimNext($device);$job=$service->transition($device,$job,$claim['claim_id'],$claim['claim_token'],'failed',['retryable'=>true,'error_code'=>'test']);if($attempt<3){$this->assertSame('retry_wait',$job->status);$job->update(['available_at'=>now()->subSecond()]);}}
        $this->assertSame('failed',$job->status);$retry=$service->manualRetry($job,$user);$this->assertSame('pending',$retry->status);$this->assertSame($job->id,$retry->manually_retried_from_job_id);
    }

    public function test_expired_lease_is_released_and_wrong_device_cannot_transition(): void
    {
        Event::fake();$user=User::factory()->create();$branch=$this->branch();$device=$this->device($branch);$other=$this->device($branch);$service=app(PrintJobService::class);$job=$service->createTest($device,$user,null,null);$claim=$service->claimNext($device);$job->update(['lease_expires_at'=>now()->subSecond()]);$this->assertSame(1,$service->releaseExpired($device));$this->assertSame('pending',$job->fresh()->status);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class);$service->transition($other,$job,$claim['claim_id'],$claim['claim_token'],'processing');
    }

    public function test_revoked_device_token_is_rejected_by_device_middleware(): void
    {
        $device=$this->device();$token=$device->createToken('test',['print-device:heartbeat'])->plainTextToken;$device->update(['status'=>'revoked','revoked_at'=>now()]);
        $this->withToken($token)->postJson('/api/print-agent/heartbeat')->assertUnauthorized();
    }
}
