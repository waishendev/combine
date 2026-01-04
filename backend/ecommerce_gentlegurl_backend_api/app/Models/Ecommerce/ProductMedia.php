<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductMedia extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'type',
        'disk',
        'path',
        'thumbnail_path',
        'sort_order',
        'mime_type',
        'size_bytes',
        'width',
        'height',
        'duration_seconds',
        'status',
    ];

    protected $appends = [
        'url',
        'thumbnail_url',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration_seconds' => 'float',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function getUrlAttribute(): ?string
    {
        if (empty($this->path)) {
            return null;
        }

        if (Str::startsWith($this->path, ['http://', 'https://'])) {
            return $this->path;
        }

        return Storage::disk($this->disk ?? 'public')->url($this->path);
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (empty($this->thumbnail_path)) {
            return null;
        }

        if (Str::startsWith($this->thumbnail_path, ['http://', 'https://'])) {
            return $this->thumbnail_path;
        }

        return Storage::disk($this->disk ?? 'public')->url($this->thumbnail_path);
    }
}
