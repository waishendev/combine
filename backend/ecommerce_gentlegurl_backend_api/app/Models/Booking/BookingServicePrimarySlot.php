<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServicePrimarySlot extends Model
{
    protected $fillable = [
        'booking_service_id', 'start_time', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function service()
    {
        return $this->belongsTo(BookingService::class, 'booking_service_id');
    }
}
