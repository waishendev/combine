<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VoucherUsage extends Model
{
    use HasFactory;

    protected $fillable = [
        'voucher_id',
        'customer_id',
        'order_id',
        'customer_voucher_id',
        'store_location_id',
        'discount_amount',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'used_at' => 'datetime',
            'discount_amount' => 'decimal:2',
        ];
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function customerVoucher()
    {
        return $this->belongsTo(CustomerVoucher::class);
    }

    public function storeLocation()
    {
        return $this->belongsTo(StoreLocation::class);
    }
}
