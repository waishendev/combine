<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Ecommerce\ProductReview;
use App\Models\Ecommerce\ProductMedia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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

    public function media()
    {
        return $this->hasMany(ProductMedia::class);
    }

    public function images()
    {
        return $this->media()
            ->where('type', 'image')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function video()
    {
        return $this->hasOne(ProductMedia::class)
            ->where('type', 'video');
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
     * Get the meta OG image URL
     */
    public function getMetaOgImageAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return $value;
        }

        // 如果已经是完整的 URL，直接返回
        if (Str::startsWith($value, ['http://', 'https://'])) {
            return $value;
        }

        // 如果是以 products/ 开头的相对路径（表示是上传的文件），使用 Storage 生成 URL
        if (Str::startsWith($value, 'products/')) {
            return Storage::disk('public')->url($value);
        }

        // 其他情况（如外部 URL 或其他路径格式），直接返回
        return $value;
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
