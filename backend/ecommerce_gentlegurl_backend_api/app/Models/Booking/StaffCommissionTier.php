<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;

class StaffCommissionTier extends Model
{
    protected $fillable = [
        'min_sales',
        'commission_percent',
    ];
}

