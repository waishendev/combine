<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ProductStockMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'product_variant_id',
        'order_id',
        'type',
        'quantity_before',
        'quantity_change',
        'quantity_after',
        'cost_price_before',
        'cost_price_after',
        'inventory_value_before',
        'inventory_value_after',
        'input_cost_price_per_unit',
        'remark',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'product_variant_id' => 'integer',
            'order_id' => 'integer',
            'quantity_before' => 'integer',
            'quantity_change' => 'integer',
            'quantity_after' => 'integer',
            'cost_price_before' => 'decimal:2',
            'cost_price_after' => 'decimal:2',
            'inventory_value_before' => 'decimal:2',
            'inventory_value_after' => 'decimal:2',
            'input_cost_price_per_unit' => 'decimal:2',
            'created_by_user_id' => 'integer',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }
}
