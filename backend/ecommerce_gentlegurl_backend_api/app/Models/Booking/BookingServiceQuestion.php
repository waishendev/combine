<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServiceQuestion extends Model
{
    protected $fillable = [
        'booking_service_id',
        'question_preset_id',
        'source_preset_question_id',
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

    public function options()
    {
        return $this->hasMany(BookingServiceQuestionOption::class, 'booking_service_question_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function questionPreset()
    {
        return $this->belongsTo(BookingQuestionPreset::class, 'question_preset_id');
    }

    public function sourcePresetQuestion()
    {
        return $this->belongsTo(BookingQuestionPresetQuestion::class, 'source_preset_question_id');
    }
}
