<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingPayment extends Model
{
    protected $fillable = ['booking_id', 'provider', 'ref', 'amount', 'status', 'raw_response'];

    protected $casts = ['raw_response' => 'array'];
}
