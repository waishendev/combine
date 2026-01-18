<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderVoucher extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'voucher_id',
        'customer_voucher_id',
        'code_snapshot',
        'discount_amount',
        'scope_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'discount_amount' => 'decimal:2',
            'scope_snapshot' => 'array',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function customerVoucher()
    {
        return $this->belongsTo(CustomerVoucher::class);
    }
}
