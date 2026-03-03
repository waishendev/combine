<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingBlock extends Model
{
    protected $fillable = ['scope', 'staff_id', 'start_at', 'end_at', 'reason', 'created_by_staff_id'];

    protected $casts = ['start_at' => 'datetime', 'end_at' => 'datetime'];
}
