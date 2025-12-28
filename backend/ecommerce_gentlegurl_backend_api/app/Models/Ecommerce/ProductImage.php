<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'image_path',
        'is_main',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_main' => 'boolean',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function getImagePathAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return $value;
        }

        // 如果已经是完整的 URL，直接返回
        if (Str::startsWith($value, ['http://', 'https://'])) {
            return $value;
        }

        // 使用 Storage 来生成正确的 URL（会自动添加 /storage 前缀）
        return Storage::disk('public')->url($value);
    }
}
