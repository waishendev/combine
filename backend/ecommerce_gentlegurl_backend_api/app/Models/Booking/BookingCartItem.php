<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingCartItem extends Model
{
    protected $fillable = [
        'booking_cart_id', 'service_id', 'staff_id', 'service_type', 'start_at', 'end_at', 'addon_duration_min', 'addon_price', 'question_answers_json', 'expires_at', 'status',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'expires_at' => 'datetime',
        'question_answers_json' => 'array',
        'addon_price' => 'decimal:2',
    ];

    public function service()
    {
        return $this->belongsTo(BookingService::class, 'service_id');
    }

    public function staff()
    {
        return $this->belongsTo(\App\Models\Staff::class, 'staff_id');
    }

    public function photos()
    {
        return $this->hasMany(BookingItemPhoto::class, 'booking_cart_item_id')->orderBy('sort_order')->orderBy('id');
    }
}

