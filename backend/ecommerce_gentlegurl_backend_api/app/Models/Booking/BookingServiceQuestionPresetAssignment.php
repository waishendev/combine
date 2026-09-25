<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServiceQuestionPresetAssignment extends Model
{
    protected $fillable = ['booking_service_id', 'booking_question_preset_question_id', 'sort_order'];

    public function question()
    {
        return $this->belongsTo(BookingQuestionPresetQuestion::class, 'booking_question_preset_question_id');
    }
}
