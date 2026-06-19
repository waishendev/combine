<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class PosCartItem extends Model
{
    protected $fillable = [
        'pos_cart_id',
        'item_type',
        'product_id',
        'booking_product_id',
        'variant_id',
        'qty',
        'price_snapshot',
        'selected_booking_product_options',
        'discount_type',
        'discount_value',
        'discount_amount',
        'discount_remark',
        'line_total_after_discount',
        'price_override_line_total',
        'price_override_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'price_snapshot' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'line_total_after_discount' => 'decimal:2',
            'price_override_line_total' => 'decimal:2',
            'price_override_snapshot' => 'array',
            'discount_remark' => 'string',
            'selected_booking_product_options' => 'array',
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

    public function bookingProduct()
    {
        return $this->belongsTo(\App\Models\Booking\BookingProduct::class, 'booking_product_id');
    }
}
