<?php

namespace App\Models\Ecommerce;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ReviewPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'review_id',
        'file_path',
    ];

    protected $appends = [
        'file_url',
    ];

    public function review(): BelongsTo
    {
        return $this->belongsTo(PageReview::class, 'review_id');
    }

    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) {
            return null;
        }

        // If it's already a full URL, return it as is
        if (filter_var($this->file_path, FILTER_VALIDATE_URL)) {
            return $this->file_path;
        }

        // Normalize path: remove leading slash to avoid double slashes
        $normalizedPath = ltrim($this->file_path, '/');

        // If it's a storage path, return the full URL
        if (Storage::disk('public')->exists($normalizedPath)) {
            return Storage::disk('public')->url($normalizedPath);
        }

        // Fallback: construct URL manually (ensure no double slashes)
        $path = ltrim($this->file_path, '/');
        return url('storage/' . $path);
    }

    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
