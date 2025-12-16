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
        'product_name_snapshot',
        'sku_snapshot',
        'price_snapshot',
        'quantity',
        'line_total',
        'is_package',
        'parent_package_item_id',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'quantity' => 'integer',
            'line_total' => 'decimal:2',
            'is_package' => 'boolean',
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

    public function parentPackageItem()
    {
        return $this->belongsTo(OrderItem::class, 'parent_package_item_id');
    }

    public function childItems()
    {
        return $this->hasMany(OrderItem::class, 'parent_package_item_id');
    }
}
