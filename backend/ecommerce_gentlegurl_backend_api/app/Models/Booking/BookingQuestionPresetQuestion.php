<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPresetQuestion extends Model
{
    protected $fillable = [
        'booking_question_preset_id',
        'title',
        'cn_title',
        'description',
        'cn_description',
        'question_type',
        'sort_order',
        'is_required',
        'is_active',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function preset()
    {
        return $this->belongsTo(BookingQuestionPreset::class, 'booking_question_preset_id');
    }

    public function options()
    {
        return $this->hasMany(BookingQuestionPresetOption::class, 'booking_question_preset_question_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
