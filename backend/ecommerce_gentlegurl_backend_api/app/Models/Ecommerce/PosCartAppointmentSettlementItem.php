<?php

namespace App\Models\Ecommerce;

use App\Models\Booking\Booking;
use Illuminate\Database\Eloquent\Model;

class PosCartAppointmentSettlementItem extends Model
{
    protected $table = 'pos_cart_appointment_settlement_items';

    protected $fillable = [
        'pos_cart_id',
        'booking_id',
        'discount_type',
        'discount_value',
        'discount_remark',
    ];

    protected function casts(): array
    {
        return [
            'booking_id' => 'integer',
            'discount_value' => 'decimal:2',
            'discount_remark' => 'string',
        ];
    }

    public function cart()
    {
        return $this->belongsTo(PosCart::class, 'pos_cart_id');
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }
}
