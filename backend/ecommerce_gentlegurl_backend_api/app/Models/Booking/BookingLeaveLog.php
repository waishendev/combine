<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Models\User;
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


    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function leaveRequest()
    {
        return $this->belongsTo(BookingLeaveRequest::class, 'leave_request_id');
    }
}
