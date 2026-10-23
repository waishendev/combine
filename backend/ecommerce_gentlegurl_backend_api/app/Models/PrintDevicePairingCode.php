<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class PrintDevicePairingCode extends Model
{
    protected $fillable = ['print_device_id','code_hash','expires_at','consumed_at','consumed_ip','attempt_count','created_by_user_id'];
    protected $casts = ['expires_at'=>'datetime','consumed_at'=>'datetime'];
    public function device() { return $this->belongsTo(PrintDevice::class, 'print_device_id'); }
}
