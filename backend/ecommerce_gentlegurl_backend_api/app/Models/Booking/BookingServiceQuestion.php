<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingServiceQuestion extends Model
{
    protected $fillable = [
        'booking_service_id',
        'title',
        'description',
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
}
