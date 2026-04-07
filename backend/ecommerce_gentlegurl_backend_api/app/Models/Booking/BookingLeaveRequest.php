<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class BookingLeaveRequest extends Model
{
    protected $fillable = [
        'staff_id',
        'leave_type',
        'start_date',
        'end_date',
        'days',
        'reason',
        'status',
        'admin_remark',
        'reviewed_by_user_id',
        'reviewed_at',
        'approved_timeoff_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'days' => 'float',
        'reviewed_at' => 'datetime',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function approvedTimeoff()
    {
        return $this->belongsTo(BookingStaffTimeoff::class, 'approved_timeoff_id');
    }

    public function logs()
    {
        return $this->hasMany(BookingLeaveLog::class, 'leave_request_id');
    }
}
