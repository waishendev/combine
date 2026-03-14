<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class ServicePackageItem extends Model
{
    protected $fillable = ['service_package_id', 'booking_service_id', 'quantity'];

    protected $casts = ['quantity' => 'integer'];

    public function package()
    {
        return $this->belongsTo(ServicePackage::class, 'service_package_id');
    }

    public function bookingService()
    {
        return $this->belongsTo(BookingService::class, 'booking_service_id');
    }
}
