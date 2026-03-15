<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingCartPackageItem extends Model
{
    protected $fillable = [
        'booking_cart_id',
        'service_package_id',
        'package_name_snapshot',
        'price_snapshot',
        'qty',
        'status',
    ];

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class, 'service_package_id');
    }
}
