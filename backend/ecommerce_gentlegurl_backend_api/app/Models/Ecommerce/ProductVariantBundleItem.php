<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductVariantBundleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'bundle_variant_id',
        'component_variant_id',
        'quantity',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'bundle_variant_id' => 'integer',
            'component_variant_id' => 'integer',
            'quantity' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function bundleVariant()
    {
        return $this->belongsTo(ProductVariant::class, 'bundle_variant_id');
    }

    public function componentVariant()
    {
        return $this->belongsTo(ProductVariant::class, 'component_variant_id');
    }
}
