<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Staff extends Model
{
    protected $table = 'staffs';

    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'phone',
        'email',
        'position',
        'description',
        'avatar_path',
        'commission_rate',
        'service_commission_rate',
        'is_active',
    ];

    protected $appends = [
        'avatar_url',
    ];

    protected $casts = [
        'commission_rate' => 'decimal:4',
        'service_commission_rate' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public function admin()
    {
        return $this->hasOne(User::class, 'staff_id');
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        if (filter_var($this->avatar_path, FILTER_VALIDATE_URL)) {
            return $this->avatar_path;
        }

        return Storage::disk('public')->url(ltrim($this->avatar_path, '/'));
    }
}
