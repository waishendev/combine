<?php

namespace App\Models;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class PrintDevice extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $fillable = ['uuid', 'store_location_id', 'name', 'platform', 'status', 'app_version', 'installation_id_hash', 'last_seen_at', 'last_seen_ip', 'paired_at', 'paired_by_user_id', 'revoked_at', 'revoked_by_user_id', 'revocation_reason'];
    protected $casts = ['last_seen_at' => 'datetime', 'paired_at' => 'datetime', 'revoked_at' => 'datetime'];

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
    public function printers() { return $this->hasMany(Printer::class); }
    public function jobs() { return $this->hasMany(PrintJob::class); }
    public function pairingCodes() { return $this->hasMany(PrintDevicePairingCode::class); }
    public function isActive(): bool { return $this->status === 'active' && $this->revoked_at === null; }
}
