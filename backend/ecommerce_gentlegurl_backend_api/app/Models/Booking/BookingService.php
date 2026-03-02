<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingService extends Model
{
    protected $fillable = [
        'name', 'service_type', 'description', 'duration_min', 'deposit_amount', 'buffer_min', 'is_active', 'rules_json',
    ];

    protected $casts = [
        'rules_json' => 'array',
        'is_active' => 'boolean',
        'service_type' => 'string',
    ];
}
