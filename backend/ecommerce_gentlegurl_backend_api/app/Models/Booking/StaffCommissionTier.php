<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class StaffCommissionTier extends Model
{
    protected $fillable = [
        'type',
        'store_location_id',
        'min_sales',
        'commission_percent',
    ];

    protected $casts = [
        'min_sales' => 'decimal:2',
        'commission_percent' => 'decimal:2',
    ];

    public function storeLocation()
    {
        return $this->belongsTo(\App\Models\Ecommerce\StoreLocation::class);
    }
}
