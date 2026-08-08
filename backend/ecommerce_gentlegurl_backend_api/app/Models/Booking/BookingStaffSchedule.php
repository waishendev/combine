<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Eloquent\Model;

class BookingStaffSchedule extends Model
{
    protected $fillable = ['staff_id', 'store_location_id', 'day_of_week', 'start_time', 'end_time', 'break_start', 'break_end', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
}
