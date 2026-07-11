<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;

class BookingLeaveRequest extends Model
{
    protected $fillable = [
        'staff_id',
        'leave_type',
        'request_kind',
        'source_leave_request_id',
        'day_type',
        'start_date',
        'end_date',
        'days',
        'reason',
        'change_reason',
        'status',
        'date_change_pending',
        'admin_remark',
        'reviewed_by_user_id',
        'reviewed_at',
        'approved_timeoff_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'days' => 'float',
        'date_change_pending' => 'boolean',
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

    public function creationLog()
    {
        return $this->hasOne(BookingLeaveLog::class, 'leave_request_id')
            ->where('action_type', 'created')
            ->latest('id');
    }

    public function approvedTimeoff()
    {
        return $this->belongsTo(BookingStaffTimeoff::class, 'approved_timeoff_id');
    }

    public function sourceLeaveRequest()
    {
        return $this->belongsTo(self::class, 'source_leave_request_id');
    }

    public function pendingDateChangeRequest()
    {
        return $this->hasOne(self::class, 'source_leave_request_id')
            ->where('request_kind', 'date_change')
            ->where('status', 'pending');
    }

    public function logs()
    {
        return $this->hasMany(BookingLeaveLog::class, 'leave_request_id');
    }

        /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
     */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
