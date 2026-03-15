<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\BookingService;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class OrderServiceItem extends Model
{
    protected $fillable = [
        'order_id', 'booking_id', 'booking_service_id', 'customer_id', 'service_name_snapshot', 'price_snapshot', 'qty', 'line_total',
        'assigned_staff_id', 'start_at', 'end_at', 'notes', 'staff_splits', 'commission_rate_used', 'commission_amount', 'item_type',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'qty' => 'integer',
            'line_total' => 'decimal:2',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'staff_splits' => 'array',
            'commission_rate_used' => 'decimal:4',
            'commission_amount' => 'decimal:2',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
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
