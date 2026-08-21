<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Role extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'name',
        'store_location_id',
        'description',
        'is_active',
        'is_system',
        'is_default',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_system' => 'boolean',
        'is_default' => 'boolean',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class);
    }

    public function permissions()
    {
        return $this->belongsToMany(Permission::class);
    }

    public function storeLocation()
    {
        return $this->belongsTo(\App\Models\Ecommerce\StoreLocation::class);
    }

    public function branchUsers()
    {
        return $this->belongsToMany(User::class, 'role_user_store_location')
            ->withPivot('store_location_id')->withTimestamps();
    }
}
