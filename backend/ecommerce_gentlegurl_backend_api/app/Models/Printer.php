<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Printer extends Model
{
    protected $fillable = ['uuid','print_device_id','name','role','connection_type','configuration','capabilities','paper_width','is_default','is_active'];
    protected $casts = ['configuration'=>'encrypted:array','capabilities'=>'array','paper_width'=>'integer','is_default'=>'boolean','is_active'=>'boolean'];
    public function device() { return $this->belongsTo(PrintDevice::class, 'print_device_id'); }
}
