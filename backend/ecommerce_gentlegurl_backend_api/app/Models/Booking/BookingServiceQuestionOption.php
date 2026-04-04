<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServiceQuestionOption extends Model
{
    protected $fillable = [
        'booking_service_question_id',
        'label',
        'linked_booking_service_id',
        'extra_duration_min',
        'extra_price',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'extra_price' => 'decimal:2',
    ];

    public function question()
    {
        return $this->belongsTo(BookingServiceQuestion::class, 'booking_service_question_id');
    }

    public function linkedBookingService()
    {
        return $this->belongsTo(BookingService::class, 'linked_booking_service_id');
    }
}
