<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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

        if (Str::startsWith($value, ['http://', 'https://'])) {
            return $value;
        }

        $appUrl = rtrim(config('app.url'), '/');
        if ($appUrl === '') {
            return $value;
        }

        $normalizedPath = Str::startsWith($value, '/') ? $value : '/' . $value;

        return $appUrl . $normalizedPath;
    }
}
