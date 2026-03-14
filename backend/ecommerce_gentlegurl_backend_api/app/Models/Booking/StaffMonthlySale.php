<?php

namespace App\Models\Booking;

use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class StaffMonthlySale extends Model
{
    protected $fillable = [
        'staff_id',
        'year',
        'month',
        'total_sales',
        'booking_count',
        'tier_percent',
        'commission_amount',
        'is_overridden',
        'override_amount',
    ];

    protected $casts = [
        'total_sales' => 'decimal:2',
        'tier_percent' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'override_amount' => 'decimal:2',
        'is_overridden' => 'boolean',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }
}

