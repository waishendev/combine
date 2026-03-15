<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class ServicePackage extends Model
{
    protected $fillable = [
        'name', 'description', 'selling_price', 'total_sessions', 'valid_days', 'is_active',
    ];

    protected $casts = [
        'selling_price' => 'decimal:2',
        'total_sessions' => 'integer',
        'valid_days' => 'integer',
        'is_active' => 'boolean',
    ];

    public function items()
    {
        return $this->hasMany(ServicePackageItem::class);
    }
}
