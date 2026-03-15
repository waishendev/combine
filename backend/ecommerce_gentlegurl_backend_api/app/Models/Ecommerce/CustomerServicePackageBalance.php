<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class CustomerServicePackageBalance extends Model
{
    protected $fillable = [
        'customer_service_package_id',
        'booking_service_id',
        'total_quantity',
        'used_quantity',
    ];

    protected $casts = [
        'total_quantity' => 'integer',
        'used_quantity' => 'integer',
    ];

    public function customerServicePackage()
    {
        return $this->belongsTo(CustomerServicePackage::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(\App\Models\Booking\BookingService::class, 'booking_service_id');
    }

    public function getRemainingQuantityAttribute(): int
    {
        return max(0, (int) $this->total_quantity - (int) $this->used_quantity);
    }
}
