<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductVariant extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'sku',
        'title',
        'price',
        'sale_price',
        'sale_price_start_at',
        'sale_price_end_at',
        'cost_price',
        'stock',
        'low_stock_threshold',
        'track_stock',
        'is_bundle',
        'is_active',
        'sort_order',
        'image_path',
    ];

    protected $appends = [
        'image_url',
        'derived_available_qty',
        'derived_cost_price',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'sale_price_start_at' => 'datetime',
            'sale_price_end_at' => 'datetime',
            'cost_price' => 'decimal:2',
            'stock' => 'integer',
            'low_stock_threshold' => 'integer',
            'track_stock' => 'boolean',
            'is_bundle' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function bundleItems()
    {
        return $this->hasMany(ProductVariantBundleItem::class, 'bundle_variant_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function componentOfBundles()
    {
        return $this->hasMany(ProductVariantBundleItem::class, 'component_variant_id');
    }

    public function derivedAvailableQty(): ?int
    {
        if (! $this->is_bundle) {
            return $this->track_stock ? (int) ($this->stock ?? 0) : null;
        }

        $this->loadMissing('bundleItems.componentVariant');

        $limits = [];
        foreach ($this->bundleItems as $bundleItem) {
            $component = $bundleItem->componentVariant;
            if (! $component) {
                continue;
            }
            if (! $component->track_stock) {
                continue;
            }
            $stock = (int) ($component->stock ?? 0);
            $required = max(1, (int) ($bundleItem->quantity ?? 1));
            $limits[] = intdiv($stock, $required);
        }

        if (empty($limits)) {
            return null;
        }

        return min($limits);
    }

    public function derivedCostPrice(): ?float
    {
        if (! $this->is_bundle) {
            return $this->cost_price !== null ? (float) $this->cost_price : null;
        }

        $this->loadMissing('bundleItems.componentVariant');

        $total = 0.0;
        foreach ($this->bundleItems as $bundleItem) {
            $component = $bundleItem->componentVariant;
            if (! $component) {
                continue;
            }

            $required = max(1, (int) ($bundleItem->quantity ?? 1));
            $componentCost = (float) ($component->cost_price ?? 0);
            $total += $componentCost * $required;
        }

        return round($total, 2);
    }

    public function getDerivedAvailableQtyAttribute(): ?int
    {
        return $this->derivedAvailableQty();
    }

    public function getDerivedCostPriceAttribute(): ?float
    {
        return $this->derivedCostPrice();
    }

    public function getImageUrlAttribute(): ?string
    {
        $path = $this->image_path;

        if (!$path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }
}
