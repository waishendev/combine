<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingCancellationRequest extends Model
{
    protected $fillable = [
        'booking_id',
        'customer_id',
        'reason',
        'status',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }
}
