<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class CustomerServicePackageBalance extends Model
{
    protected $fillable = [
        'customer_service_package_id', 'booking_service_id', 'service_name_snapshot',
        'total_qty', 'used_qty', 'remaining_qty', 'redemption_value_snapshot',
    ];

    protected $casts = [
        'total_qty' => 'integer',
        'used_qty' => 'integer',
        'remaining_qty' => 'integer',
    ];

    public function customerServicePackage()
    {
        return $this->belongsTo(CustomerServicePackage::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(BookingService::class);
    }
}
