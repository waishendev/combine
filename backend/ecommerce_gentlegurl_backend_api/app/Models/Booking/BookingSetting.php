<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class BookingSetting extends Model
{
    protected $fillable = [
        'deposit_amount_per_premium',
        'deposit_base_amount_if_only_standard',
        'cart_hold_minutes',
    ];
}
