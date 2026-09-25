<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPresetOption extends Model
{
    protected $fillable = ['label', 'cn_label', 'sort_order', 'is_active', 'allow_quantity'];
    protected $casts = ['is_active' => 'boolean', 'allow_quantity' => 'boolean'];

    public function preset()
    {
        return $this->belongsTo(BookingQuestionPreset::class, 'booking_question_preset_id');
    }
}
