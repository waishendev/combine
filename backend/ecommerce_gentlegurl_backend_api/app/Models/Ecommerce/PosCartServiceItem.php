<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\BookingService;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class PosCartServiceItem extends Model
{
    protected $fillable = [
        'pos_cart_id', 'booking_service_id', 'customer_id', 'service_name_snapshot', 'price_snapshot',
        'qty', 'assigned_staff_id', 'start_at', 'end_at', 'notes', 'staff_splits', 'commission_rate_used',
        'addon_duration_min', 'addon_price', 'selected_option_ids', 'addon_items_json',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'qty' => 'integer',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'staff_splits' => 'array',
            'commission_rate_used' => 'decimal:4',
            'addon_duration_min' => 'integer',
            'addon_price' => 'decimal:2',
            'selected_option_ids' => 'array',
            'addon_items_json' => 'array',
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
