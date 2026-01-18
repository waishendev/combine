<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;


class Voucher extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'type',
        'value',
        'amount',
        'min_order_amount',
        'scope_type',
        'max_discount_amount',
        'start_at',
        'end_at',
        'usage_limit_total',
        'usage_limit_per_customer',
        'max_uses',
        'max_uses_per_customer',
        'is_active',
        'is_reward_only',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'amount' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'max_discount_amount' => 'decimal:2',
            'usage_limit_total' => 'integer',
            'usage_limit_per_customer' => 'integer',
            'max_uses' => 'integer',
            'max_uses_per_customer' => 'integer',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'is_active' => 'boolean',
            'is_reward_only' => 'boolean',
        ];
    }

    public function usages()
    {
        return $this->hasMany(VoucherUsage::class);
    }

    public function customerVouchers()
    {
        return $this->hasMany(CustomerVoucher::class);
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'voucher_products');
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'voucher_categories');
    }

    /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
    */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
