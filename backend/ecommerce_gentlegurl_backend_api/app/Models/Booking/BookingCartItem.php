<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingCartItem extends Model
{
    protected $fillable = [
        'booking_cart_id', 'service_id', 'staff_id', 'service_type', 'start_at', 'end_at', 'expires_at', 'status',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function service()
    {
        return $this->belongsTo(BookingService::class, 'service_id');
    }

    public function staff()
    {
        return $this->belongsTo(\App\Models\Staff::class, 'staff_id');
    }
}
