<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
class PrintJob extends Model
{
    use HasUlids;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['store_location_id','print_device_id','printer_id','type','status','payload_schema_version','payload','source_type','source_id','idempotency_key','priority','available_at','attempt_count','max_attempts','claim_token_hash','claimed_at','lease_expires_at','processing_at','completed_at','failed_at','last_error_code','last_error_message','created_by_user_id','manually_retried_from_job_id'];
    protected $casts = ['payload'=>'array','available_at'=>'datetime','claimed_at'=>'datetime','lease_expires_at'=>'datetime','processing_at'=>'datetime','completed_at'=>'datetime','failed_at'=>'datetime'];
    public function device() { return $this->belongsTo(PrintDevice::class, 'print_device_id'); }
    public function printer() { return $this->belongsTo(Printer::class); }
    public function attempts() { return $this->hasMany(PrintJobAttempt::class); }
}
