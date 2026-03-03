<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingStaffTimeoff extends Model
{
    protected $fillable = ['staff_id', 'start_at', 'end_at', 'reason'];

    protected $casts = ['start_at' => 'datetime', 'end_at' => 'datetime'];
}
