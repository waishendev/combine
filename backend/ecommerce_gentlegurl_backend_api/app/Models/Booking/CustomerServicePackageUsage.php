<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use Illuminate\Database\Eloquent\Model;

class CustomerServicePackageUsage extends Model
{
    protected $fillable = [
        'customer_service_package_id', 'customer_id', 'booking_service_id',
        'used_qty', 'used_from', 'used_ref_id', 'notes',
    ];

    protected $casts = [
        'used_qty' => 'integer',
    ];

    public function customerServicePackage()
    {
        return $this->belongsTo(CustomerServicePackage::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(BookingService::class);
    }
}
