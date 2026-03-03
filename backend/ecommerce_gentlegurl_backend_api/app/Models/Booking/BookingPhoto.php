<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingPhoto extends Model
{
    public $timestamps = false;

    protected $fillable = ['booking_id', 'url', 'uploaded_by_staff_id', 'created_at'];
}
