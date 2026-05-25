<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cn_name',
        'price',
        'barcode',
        'description',
        'image_path',
        'is_active',
    ];

    protected $appends = [
        'image_url',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function questions()
    {
        return $this->hasMany(BookingProductQuestion::class, 'booking_product_id')->orderBy('sort_order')->orderBy('id');
    }

    public function activeQuestions()
    {
        return $this->questions()->where('is_active', true)->whereHas('options', fn ($query) => $query->where('is_active', true));
    }

    public function categories()
    {
        return $this->belongsToMany(BookingProductCategory::class, 'booking_product_category_product')
            ->withTimestamps();
    }

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        if (filter_var($this->image_path, FILTER_VALIDATE_URL)) {
            return $this->image_path;
        }

        return Storage::disk('public')->url(ltrim($this->image_path, '/'));
    }
}
