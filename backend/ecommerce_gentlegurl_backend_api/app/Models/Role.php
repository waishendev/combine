<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Role extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_active',
        'is_system',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class);
    }

    public function permissions()
    {
        return $this->belongsToMany(Permission::class);
    }
}
