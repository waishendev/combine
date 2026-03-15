<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\ServicePackage;
use Illuminate\Database\Eloquent\Model;

class PosCartPackageItem extends Model
{
    protected $fillable = [
        'pos_cart_id', 'service_package_id', 'package_name_snapshot', 'price_snapshot', 'qty',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'qty' => 'integer',
        ];
    }

    public function cart()
    {
        return $this->belongsTo(PosCart::class, 'pos_cart_id');
    }

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class, 'service_package_id');
    }
}
