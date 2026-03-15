<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class CustomerServicePackage extends Model
{
    protected $fillable = [
        'customer_id',
        'service_package_id',
        'assigned_by_user_id',
        'assigned_at',
        'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    public function package()
    {
        return $this->belongsTo(ServicePackage::class, 'service_package_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function balances()
    {
        return $this->hasMany(CustomerServicePackageBalance::class);
    }
}
