<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BankAccount extends Model
{
    protected $fillable = [
        'label',
        'bank_name',
        'account_name',
        'account_number',
        'branch',
        'swift_code',
        'logo_path',
        'qr_image_path',
        'is_active',
        'is_default',
        'sort_order',
        'instructions',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'logo_url',
        'qr_image_url',
    ];

    /**
     * Get the full URL for the logo
     */
    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        // If it's already a full URL, return it as is
        if (filter_var($this->logo_path, FILTER_VALIDATE_URL)) {
            return $this->logo_path;
        }

        // Normalize path: remove leading slash to avoid double slashes
        $normalizedPath = ltrim($this->logo_path, '/');

        // If it's a storage path, return the full URL
        if (Storage::disk('public')->exists($normalizedPath)) {
            return Storage::disk('public')->url($normalizedPath);
        }

        // Fallback: construct URL manually (ensure no double slashes)
        $path = ltrim($this->logo_path, '/');
        return url('storage/' . $path);
    }

    /**
     * Get the full URL for the QR image
     */
    public function getQrImageUrlAttribute(): ?string
    {
        if (!$this->qr_image_path) {
            return null;
        }

        // If it's already a full URL, return it as is
        if (filter_var($this->qr_image_path, FILTER_VALIDATE_URL)) {
            return $this->qr_image_path;
        }

        // Normalize path: remove leading slash to avoid double slashes
        $normalizedPath = ltrim($this->qr_image_path, '/');

        // If it's a storage path, return the full URL
        if (Storage::disk('public')->exists($normalizedPath)) {
            return Storage::disk('public')->url($normalizedPath);
        }

        // Fallback: construct URL manually (ensure no double slashes)
        $path = ltrim($this->qr_image_path, '/');
        return url('storage/' . $path);
    }
}
