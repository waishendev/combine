<?php

namespace App\Models\Booking;

use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class BookingStaffSchedule extends Model
{
    protected $fillable = ['staff_id', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end'];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }
}
