<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'customer_id',
        'status',
        'payment_status',
        'payment_method',
        'payment_gateway_id',
        'subtotal',
        'discount_total',
        'shipping_fee',
        'grand_total',
        'voucher_code_snapshot',
        'pickup_or_shipping',
        'pickup_store_id',
        'shipping_name',
        'shipping_phone',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_state',
        'shipping_postcode',
        'shipping_country',
        'shipping_courier',
        'shipping_tracking_no',
        'notes',
        'placed_at',
        'paid_at',
        'completed_at',
        'shipped_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'placed_at' => 'datetime',
            'paid_at' => 'datetime',
            'completed_at' => 'datetime',
            'shipped_at' => 'datetime',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function voucher()
    {
        return $this->hasOne(OrderVoucher::class);
    }

    public function vouchers()
    {
        return $this->hasMany(OrderVoucher::class);
    }

    public function uploads()
    {
        return $this->hasMany(OrderUpload::class);
    }

    public function returns()
    {
        return $this->hasMany(ReturnRequest::class);
    }

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }

    public function pickupStore()
    {
        return $this->belongsTo(StoreLocation::class, 'pickup_store_id');
    }
}
