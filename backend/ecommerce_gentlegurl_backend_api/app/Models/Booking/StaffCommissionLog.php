<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class StaffCommissionLog extends Model
{
    protected $fillable = [
        'staff_monthly_sale_id',
        'store_location_id',
        'staff_id',
        'type',
        'year',
        'month',
        'action',
        'old_values',
        'new_values',
        'remarks',
        'performed_by',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function storeLocation()
    {
        return $this->belongsTo(\App\Models\Ecommerce\StoreLocation::class);
    }
}
