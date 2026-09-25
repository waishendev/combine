<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPresetQuestion extends Model
{
    protected $fillable = ['title', 'cn_title', 'description', 'cn_description', 'question_type', 'sort_order', 'is_required', 'is_active'];
    protected $casts = ['is_required' => 'boolean', 'is_active' => 'boolean'];

    public function options()
    {
        return $this->hasMany(BookingQuestionPresetOption::class)->orderBy('sort_order')->orderBy('id');
    }

    public function preset()
    {
        return $this->belongsTo(BookingQuestionPreset::class, 'booking_question_preset_id');
    }
}
