<?php

namespace App\Models\Booking;

use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class StaffMonthlySale extends Model
{
    protected $fillable = [
        'type',
        'staff_id',
        'year',
        'month',
        'total_sales',
        'booking_count',
        'tier_percent',
        'commission_amount',
        'is_overridden',
        'override_amount',
        'tier_id_snapshot',
        'tier_percent_snapshot',
        'tier_min_sales_snapshot',
        'calculated_at',
        'status',
        'frozen_at',
        'frozen_by',
        'reopened_at',
        'reopened_by',
    ];

    protected $casts = [
        'total_sales' => 'decimal:2',
        'tier_percent' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'override_amount' => 'decimal:2',
        'is_overridden' => 'boolean',
        'tier_percent_snapshot' => 'decimal:2',
        'tier_min_sales_snapshot' => 'decimal:2',
        'calculated_at' => 'datetime',
        'frozen_at' => 'datetime',
        'reopened_at' => 'datetime',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }
}
