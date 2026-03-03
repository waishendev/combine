<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServiceStaff extends Model
{
    protected $table = 'booking_service_staff';

    protected $fillable = ['service_id', 'staff_id', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
