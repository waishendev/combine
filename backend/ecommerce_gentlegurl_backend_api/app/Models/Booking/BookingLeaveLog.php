<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingLeaveLog extends Model
{
    protected $fillable = [
        'staff_id',
        'leave_request_id',
        'action_type',
        'before_value',
        'after_value',
        'remark',
        'created_by',
    ];

    protected $casts = [
        'before_value' => 'array',
        'after_value' => 'array',
    ];
}
