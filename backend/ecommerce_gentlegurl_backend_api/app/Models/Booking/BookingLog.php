<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['booking_id', 'actor_type', 'actor_id', 'action', 'meta', 'created_at'];

    protected $casts = ['meta' => 'array'];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
