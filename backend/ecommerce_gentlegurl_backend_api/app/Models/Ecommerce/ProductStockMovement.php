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
        'is_revoked',
        'revoked_at',
        'revoked_by',
        'revoke_reason',
        'reversal_of_movement_id',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity_before' => 'integer',
            'quantity_change' => 'integer',
            'quantity_after' => 'integer',
            'product_variant_id' => 'integer',
            'cost_price_before' => 'decimal:2',
            'cost_price_after' => 'decimal:2',
            'inventory_value_before' => 'decimal:2',
            'inventory_value_after' => 'decimal:2',
            'input_cost_price_per_unit' => 'decimal:2',
            'is_revoked' => 'boolean',
            'revoked_at' => 'datetime',
            'revoked_by' => 'integer',
            'reversal_of_movement_id' => 'integer',
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

    public function revokedBy()
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    public function originalMovement()
    {
        return $this->belongsTo(self::class, 'reversal_of_movement_id');
    }

    public function reversalMovement()
    {
        return $this->hasOne(self::class, 'reversal_of_movement_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
