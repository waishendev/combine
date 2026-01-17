<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'product_id',
        'product_variant_id',
        'product_name_snapshot',
        'sku_snapshot',
        'variant_name_snapshot',
        'variant_sku_snapshot',
        'price_snapshot',
        'variant_price_snapshot',
        'variant_cost_snapshot',
        'quantity',
        'line_total',
        'is_package',
        'parent_package_item_id',
        'is_reward',
        'reward_redemption_id',
        'locked',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'variant_price_snapshot' => 'decimal:2',
            'variant_cost_snapshot' => 'decimal:2',
            'quantity' => 'integer',
            'line_total' => 'decimal:2',
            'is_package' => 'boolean',
            'is_reward' => 'boolean',
            'locked' => 'boolean',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function parentPackageItem()
    {
        return $this->belongsTo(OrderItem::class, 'parent_package_item_id');
    }

    public function childItems()
    {
        return $this->hasMany(OrderItem::class, 'parent_package_item_id');
    }

    public function redemption()
    {
        return $this->belongsTo(LoyaltyRedemption::class, 'reward_redemption_id');
    }

    public function review()
    {
        return $this->hasOne(ProductReview::class);
    }
}
