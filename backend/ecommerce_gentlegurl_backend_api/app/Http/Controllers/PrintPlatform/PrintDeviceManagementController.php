<?php
namespace App\Http\Controllers\PrintPlatform;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Services\PrintPlatform\PairingService;
use App\Services\PrintPlatform\PrintJobService;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
class PrintDeviceManagementController extends Controller
{
    public function __construct(private StoreLocationAccessService $access, private PairingService $pairing, private PrintJobService $jobs) {}
    public function index(Request $request) {
        $branchId=(int)$request->query('store_location_id',0);
        $ids=$branchId>0 ? collect([$this->access->authorizeStoreLocation($request->user(),$branchId)->id]) : $this->access->accessibleStoreLocations($request->user())->pluck('id');
        $devices=PrintDevice::with('storeLocation:id,name')->whereIn('store_location_id',$ids)->withCount('printers')->orderByDesc('created_at')->get()->map(fn($d)=>$this->deviceData($d));
        return $this->respond($devices);
    }
    public function store(Request $request) {
        $data=$request->validate(['store_location_id'=>['required','integer'],'name'=>['required','string','max:120']]);
        $branch=$this->access->authorizeStoreLocation($request->user(),(int)$data['store_location_id'],false);
        $device=PrintDevice::create(['uuid'=>(string)Str::uuid(),'store_location_id'=>$branch->id,'name'=>$data['name'],'status'=>'active','paired_by_user_id'=>$request->user()->id]);
        $code=$this->pairing->issue($device,$request->user()); $this->audit($request,'created',$device,null,$device->toArray());
        return $this->respond(['device'=>$this->deviceData($device->load('storeLocation')),'pairing_code'=>$code,'expires_at'=>now()->addMinutes(10)->toIso8601String()], 'Print device created.', true, 201);
    }
    public function pairingCode(Request $request, PrintDevice $device) { $this->authorizeDevice($request,$device); abort_unless($device->isActive(),422); $code=$this->pairing->issue($device,$request->user()); $this->audit($request,'pairing_code_generated',$device); return $this->respond(['pairing_code'=>$code,'expires_at'=>now()->addMinutes(10)->toIso8601String()]); }
    public function revoke(Request $request, PrintDevice $device) { $this->authorizeDevice($request,$device); $old=$device->toArray(); $device->update(['status'=>'revoked','revoked_at'=>now(),'revoked_by_user_id'=>$request->user()->id,'revocation_reason'=>$request->input('reason')]); $device->tokens()->delete(); $this->audit($request,'revoked',$device,$old,$device->fresh()->toArray()); return $this->respond($this->deviceData($device->fresh('storeLocation'))); }
    public function testJob(Request $request, PrintDevice $device) { $this->authorizeDevice($request,$device); abort_unless($device->isActive(),422,'Device is revoked.'); $request->validate(['message'=>['nullable','string','max:500']]); $job=$this->jobs->createTest($device,$request->user(),$request->header('Idempotency-Key'),$request->input('message')); $this->audit($request,'test_job_created',$device,null,['print_job_id'=>$job->id]); return $this->respond($job, 'Test print queued.', true, 201); }
    public function deviceJobs(Request $request, PrintDevice $device) { $this->authorizeDevice($request,$device); return $this->respond($device->jobs()->with('attempts')->latest()->limit(50)->get()); }
    public function retry(Request $request, PrintJob $job) { $device=$job->device; $this->authorizeDevice($request,$device); $retry=$this->jobs->manualRetry($job,$request->user()); $this->audit($request,'job_manual_retry',$device,null,['source_print_job_id'=>$job->id,'print_job_id'=>$retry->id]); return $this->respond($retry,'Retry queued.',true,201); }
    private function authorizeDevice(Request $r, PrintDevice $d): void { $this->access->authorizeStoreLocation($r->user(),$d->store_location_id); }
    private function deviceData(PrintDevice $d): array { return ['id'=>$d->id,'uuid'=>$d->uuid,'name'=>$d->name,'status'=>$d->status,'app_version'=>$d->app_version,'last_seen_at'=>$d->last_seen_at?->toIso8601String(),'online'=>$d->last_seen_at?->gte(now()->subSeconds(150))&&$d->isActive(),'paired_at'=>$d->paired_at?->toIso8601String(),'store_location'=>$d->storeLocation,'printers_count'=>$d->printers_count??$d->printers()->count()]; }
    private function audit(Request $r,string $action,PrintDevice $d,?array $old=null,?array $new=null): void { ActivityLog::create(['user_id'=>$r->user()->id,'user_name'=>$r->user()->name,'action'=>'print_device_'.$action,'model_type'=>PrintDevice::class,'model_id'=>$d->id,'model_label'=>$d->name,'old_values'=>$old,'new_values'=>$new,'ip_address'=>$r->ip(),'user_agent'=>$r->userAgent()]); }
}
