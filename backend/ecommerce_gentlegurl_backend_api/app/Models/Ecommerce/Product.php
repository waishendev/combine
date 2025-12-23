<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Ecommerce\ProductReview;
use DateTimeInterface;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'sku',
        'type',
        'description',
        'price',
        'cost_price',
        'stock',
        'low_stock_threshold',
        'track_stock',
        'dummy_sold_count',
        'is_active',
        'is_featured',
        'is_reward_only',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'meta_og_image',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'stock' => 'integer',
            'low_stock_threshold' => 'integer',
            'track_stock' => 'boolean',
            'dummy_sold_count' => 'integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'is_reward_only' => 'boolean',
        ];
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'product_categories');
    }

    public function packageChildren()
    {
        return $this->hasMany(ProductPackage::class, 'package_product_id');
    }

    public function packageItems()
    {
        return $this->hasMany(ProductPackage::class, 'child_product_id');
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
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
