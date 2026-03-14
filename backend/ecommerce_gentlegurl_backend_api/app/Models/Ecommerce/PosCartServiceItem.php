<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\BookingService;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class PosCartServiceItem extends Model
{
    protected $fillable = [
        'pos_cart_id', 'booking_service_id', 'service_name_snapshot', 'price_snapshot',
        'qty', 'assigned_staff_id', 'commission_rate_used',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'qty' => 'integer',
            'commission_rate_used' => 'decimal:4',
        ];
    }

    public function cart()
    {
        return $this->belongsTo(PosCart::class, 'pos_cart_id');
    }

    public function bookingService()
    {
        return $this->belongsTo(BookingService::class, 'booking_service_id');
    }

    public function assignedStaff()
    {
        return $this->belongsTo(Staff::class, 'assigned_staff_id');
    }
}
