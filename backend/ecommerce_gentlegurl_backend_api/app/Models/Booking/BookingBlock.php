<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class BookingBlock extends Model
{
    protected $fillable = ['scope', 'staff_id', 'store_location_id', 'start_at', 'end_at', 'reason', 'created_by_staff_id'];

    protected $casts = ['start_at' => 'datetime', 'end_at' => 'datetime'];

    public function staff() { return $this->belongsTo(Staff::class); }
    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
}
