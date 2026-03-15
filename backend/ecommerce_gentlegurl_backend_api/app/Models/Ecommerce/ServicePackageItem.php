<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class ServicePackageItem extends Model
{
    protected $fillable = [
        'service_package_id',
        'booking_service_id',
        'quantity',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(\App\Models\Booking\BookingService::class, 'booking_service_id');
    }
}
