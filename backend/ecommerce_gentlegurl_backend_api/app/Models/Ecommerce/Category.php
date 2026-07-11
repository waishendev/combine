<?php

namespace App\Models\Ecommerce;

use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;

class Category extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'parent_id',
        'name',
        'cn_name',
        'slug',
        'description',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'meta_og_image',
        'is_active',
        'show_in_pos_filter',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'show_in_pos_filter' => 'boolean',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function shopMenus()
    {
        return $this->belongsToMany(ShopMenuItem::class, 'category_shop_menu_items')
            ->withPivot('sort_order')
            ->withTimestamps();
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'product_categories');
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
