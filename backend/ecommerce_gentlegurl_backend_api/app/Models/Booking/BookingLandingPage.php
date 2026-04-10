<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingLandingPage extends Model
{
    protected $fillable = [
        'slug',
        'sections',
        'is_active',
    ];

    protected $casts = [
        'sections' => 'array',
        'is_active' => 'boolean',
    ];
}
