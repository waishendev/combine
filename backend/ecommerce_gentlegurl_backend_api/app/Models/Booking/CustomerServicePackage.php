<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use Illuminate\Database\Eloquent\Model;

class CustomerServicePackage extends Model
{
    protected $fillable = [
        'customer_id', 'service_package_id', 'package_name_snapshot', 'selling_price_snapshot',
        'purchase_amount_snapshot', 'refunded_amount_snapshot', 'purchase_reference_snapshot',
        'purchased_from', 'purchased_ref_id', 'started_at', 'expires_at', 'status',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class);
    }

    public function balances()
    {
        return $this->hasMany(CustomerServicePackageBalance::class);
    }

    public function usages()
    {
        return $this->hasMany(CustomerServicePackageUsage::class);
    }
}
