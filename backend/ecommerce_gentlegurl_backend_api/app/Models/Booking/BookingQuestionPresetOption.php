<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPresetOption extends Model
{
    protected $fillable = ['booking_question_preset_id', 'booking_question_preset_question_id', 'label', 'cn_label', 'linked_booking_service_id', 'sort_order', 'is_active', 'allow_quantity'];
    protected $casts = ['is_active' => 'boolean', 'allow_quantity' => 'boolean'];

    public function preset()
    {
        return $this->belongsTo(BookingQuestionPreset::class, 'booking_question_preset_id');
    }

    public function question()
    {
        return $this->belongsTo(BookingQuestionPresetQuestion::class, 'booking_question_preset_question_id');
    }

    public function linkedBookingService()
    {
        return $this->belongsTo(BookingService::class, 'linked_booking_service_id');
    }
}
