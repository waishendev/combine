<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingLeaveBalance extends Model
{
    protected $fillable = [
        'staff_id',
        'leave_type',
        'entitled_days',
    ];

    protected $casts = [
        'entitled_days' => 'float',
    ];
}
