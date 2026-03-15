<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use Illuminate\Database\Eloquent\Model;

class CustomerServicePackageUsage extends Model
{
    protected $fillable = [
        'customer_service_package_id', 'customer_id', 'booking_id', 'booking_service_id',
        'used_qty', 'used_from', 'used_ref_id', 'status', 'reserved_at', 'consumed_at', 'released_at', 'notes',
    ];

    protected $casts = [
        'used_qty' => 'integer',
        'reserved_at' => 'datetime',
        'consumed_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function customerServicePackage()
    {
        return $this->belongsTo(CustomerServicePackage::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(BookingService::class);
    }
}
