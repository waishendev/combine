<?php

namespace App\Models\Booking;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class BookingCancellationRequest extends Model
{
    protected $fillable = [
        'booking_id',
        'customer_id',
        'status',
        'reason',
        'admin_note',
        'requested_at',
        'reviewed_at',
        'reviewed_by_admin_id',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by_admin_id');
    }
}
