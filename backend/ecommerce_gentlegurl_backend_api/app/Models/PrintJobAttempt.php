<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PrintJobAttempt extends Model
{
    protected $fillable = ['print_job_id','print_device_id','claim_id','attempt_number','status','claimed_at','started_at','finished_at','lease_expires_at','result_code','error_message','metadata'];
    protected $casts = ['claimed_at'=>'datetime','started_at'=>'datetime','finished_at'=>'datetime','lease_expires_at'=>'datetime','metadata'=>'array'];
    public function job() { return $this->belongsTo(PrintJob::class, 'print_job_id'); }
}
