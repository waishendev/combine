<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingItemPhoto extends Model
{
    protected $fillable = [
        'booking_cart_item_id',
        'booking_id',
        'file_path',
        'original_name',
        'mime_type',
        'size',
        'sort_order',
    ];

    protected $appends = ['file_url'];

    public function cartItem()
    {
        return $this->belongsTo(BookingCartItem::class, 'booking_cart_item_id');
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    public function getFileUrlAttribute(): ?string
    {
        if (! $this->file_path) {
            return null;
        }

        if (filter_var($this->file_path, FILTER_VALIDATE_URL)) {
            return $this->file_path;
        }

        return Storage::disk('public')->url(ltrim($this->file_path, '/'));
    }
}
