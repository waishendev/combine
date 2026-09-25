<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingQuestionPreset extends Model
{
    protected $fillable = ['name', 'title', 'cn_title', 'description', 'cn_description', 'question_type', 'is_required', 'is_active'];

    protected $casts = ['is_required' => 'boolean', 'is_active' => 'boolean'];

    public function options()
    {
        return $this->hasMany(BookingQuestionPresetOption::class)->orderBy('sort_order')->orderBy('id');
    }
}
