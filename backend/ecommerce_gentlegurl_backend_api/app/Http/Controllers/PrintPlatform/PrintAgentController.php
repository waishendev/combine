<?php
namespace App\Http\Controllers\PrintPlatform;
use App\Http\Controllers\Controller;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Services\PrintPlatform\PairingService;
use App\Services\PrintPlatform\PrintJobService;
use Illuminate\Http\Request;
class PrintAgentController extends Controller
{
    public function __construct(private PairingService $pairing, private PrintJobService $jobs) {}
    public function pair(Request $request) { $data=$request->validate(['pairing_code'=>['required','string','max:20'],'device_name'=>['required','string','max:120'],'app_version'=>['nullable','string','max:50'],'installation_id'=>['required','string','max:200']]); $paired=$this->pairing->pair($data['pairing_code'],$data,$request->ip()); return $this->respond(['token'=>$paired['token'],'device'=>$this->present($paired['device'])]); }
    public function me(Request $request) { return $this->respond($this->present($request->user()->load('storeLocation'))); }
    public function heartbeat(Request $request) { $request->validate(['app_version'=>['nullable','string','max:50']]); $device=$request->user(); if (!$device->last_seen_at || $device->last_seen_at->lt(now()->subSeconds(55))) $device->update(['last_seen_at'=>now(),'last_seen_ip'=>$request->ip(),'app_version'=>$request->input('app_version',$device->app_version)]); return $this->respond(['server_time'=>now()->toIso8601String(),'last_seen_at'=>$device->fresh()->last_seen_at?->toIso8601String()]); }
    public function pending(Request $request) { $d=$request->user(); $this->jobs->releaseExpired($d); return $this->respond($d->jobs()->whereIn('status',['pending','retry_wait'])->where('available_at','<=',now())->orderBy('created_at')->get(['id','type','status','created_at'])); }
    public function claim(Request $request) { return $this->respond($this->jobs->claimNext($request->user())); }
    public function processing(Request $r, PrintJob $job) { return $this->state($r,$job,'processing'); }
    public function succeeded(Request $r, PrintJob $job) { return $this->state($r,$job,'succeeded'); }
    public function failed(Request $r, PrintJob $job) { return $this->state($r,$job,'failed'); }
    public function rotate(Request $request) { $d=$request->user(); $old=$d->currentAccessToken(); $token=$d->createToken('android-rotated',['print-device:connect','print-device:jobs','print-device:heartbeat'])->plainTextToken; $old?->delete(); return $this->respond(['token'=>$token]); }
    private function state(Request $r,PrintJob $j,string $state) { $data=$r->validate(['claim_id'=>['required','uuid'],'claim_token'=>['required','string'],'result_code'=>['nullable','string','max:100'],'error_code'=>['nullable','string','max:100'],'message'=>['nullable','string','max:2000'],'retryable'=>['nullable','boolean']]); return $this->respond($this->jobs->transition($r->user(),$j,$data['claim_id'],$data['claim_token'],$state,$data)); }
    private function present(PrintDevice $d): array { return ['uuid'=>$d->uuid,'name'=>$d->name,'status'=>$d->status,'branch'=>['id'=>$d->storeLocation->id,'name'=>$d->storeLocation->name],'last_seen_at'=>$d->last_seen_at?->toIso8601String()]; }
}
