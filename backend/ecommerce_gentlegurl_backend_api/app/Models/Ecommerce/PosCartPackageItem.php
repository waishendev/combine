<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\ServicePackage;
use App\Models\Ecommerce\Customer;
use Illuminate\Database\Eloquent\Model;

class PosCartPackageItem extends Model
{
    protected $fillable = [
        'pos_cart_id', 'service_package_id', 'customer_id', 'package_name_snapshot', 'price_snapshot', 'qty', 'staff_splits',
        'discount_type', 'discount_value', 'discount_remark',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'qty' => 'integer',
            'customer_id' => 'integer',
            'staff_splits' => 'array',
            'discount_value' => 'decimal:2',
            'discount_remark' => 'string',
        ];
    }

    public function cart()
    {
        return $this->belongsTo(PosCart::class, 'pos_cart_id');
    }


    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class, 'service_package_id');
    }
}
