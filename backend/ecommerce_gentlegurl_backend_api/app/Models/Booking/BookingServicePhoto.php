<?php

namespace App\Models\Booking;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingServicePhoto extends Model
{
    protected $fillable = [
        'booking_id',
        'image_path',
        'caption',
        'uploaded_by',
        'sort_order',
    ];

    protected $appends = ['image_url'];

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
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
