<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class ServicePackageStaffSplit extends Model
{
    protected $fillable = [
        'order_id',
        'customer_service_package_id',
        'service_package_id',
        'customer_id',
        'staff_id',
        'share_percent',
        'split_sales_amount',
        'service_commission_rate_snapshot',
        'commission_amount_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'integer',
            'split_sales_amount' => 'decimal:2',
            'service_commission_rate_snapshot' => 'decimal:4',
            'commission_amount_snapshot' => 'decimal:2',
        ];
    }
}
