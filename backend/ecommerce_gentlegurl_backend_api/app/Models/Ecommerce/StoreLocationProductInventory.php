<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class StoreLocationProductInventory extends Model
{
    protected $fillable = ['store_location_id', 'product_id', 'product_variant_id', 'quantity'];

    protected $casts = ['quantity' => 'integer', 'variant_identity' => 'integer'];

    protected static function booted(): void
    {
        static::saving(function (self $inventory): void {
            if ($inventory->product_variant_id) {
                $variant = ProductVariant::query()->find($inventory->product_variant_id);
                if (! $variant || (int) $variant->product_id !== (int) $inventory->product_id) {
                    throw ValidationException::withMessages(['product_variant_id' => 'The variant must belong to the inventory Product.']);
                }
            }
        });
    }

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
    public function product() { return $this->belongsTo(Product::class); }
    public function productVariant() { return $this->belongsTo(ProductVariant::class); }
}
