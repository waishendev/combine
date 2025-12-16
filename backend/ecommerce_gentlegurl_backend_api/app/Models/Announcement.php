<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;

class Announcement extends Model
{
    protected $fillable = [
        'key',
        'title',
        'subtitle',
        'body_text',
        'image_path',
        'button_label',
        'button_link',
        'is_active',
        'start_at',
        'end_at',
        'show_once_per_session',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'show_once_per_session' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
    ];

    protected $appends = [
        'image_url',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeCurrent($query)
    {
        $now = now();

        return $query->where(function ($q) use ($now) {
            $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
        })->where(function ($q) use ($now) {
            $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
        });
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path;
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
