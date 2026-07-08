<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingRefundReceiptToken extends Model
{
    protected $fillable = [
        'booking_refund_id',
        'token',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function bookingRefund(): BelongsTo
    {
        return $this->belongsTo(BookingRefund::class);
    }
}
