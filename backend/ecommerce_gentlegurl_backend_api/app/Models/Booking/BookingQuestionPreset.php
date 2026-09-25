<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPreset extends Model
{
    protected $fillable = [
        'name',
        'cn_name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function questions()
    {
        return $this->hasMany(BookingQuestionPresetQuestion::class, 'booking_question_preset_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function services()
    {
        return $this->belongsToMany(
            BookingService::class,
            'booking_service_question_presets',
            'booking_question_preset_id',
            'booking_service_id'
        )->withPivot('sort_order')->withTimestamps()->orderByPivot('sort_order');
    }
}
