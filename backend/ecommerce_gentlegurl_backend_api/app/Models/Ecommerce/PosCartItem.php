<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class PosCartItem extends Model
{
    protected $fillable = [
        'pos_cart_id',
        'type',
        'product_id',
        'variant_id',
        'booking_service_id',
        'service_name',
        'staff_id',
        'qty',
        'price_snapshot',
        'discount_type',
        'discount_value',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'price_snapshot' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'type' => 'string',
        ];
    }

    public function cart()
    {
        return $this->belongsTo(PosCart::class, 'pos_cart_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function bookingService()
    {
        return $this->belongsTo(\App\Models\Booking\BookingService::class, 'booking_service_id');
    }

    public function staff()
    {
        return $this->belongsTo(\App\Models\Staff::class, 'staff_id');
    }
}
