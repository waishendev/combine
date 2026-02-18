<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class PosCartItem extends Model
{
    protected $fillable = [
        'pos_cart_id',
        'product_id',
        'variant_id',
        'qty',
        'price_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'price_snapshot' => 'decimal:2',
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
}
