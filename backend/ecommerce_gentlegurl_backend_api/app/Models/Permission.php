<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Permission extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'group_id',
        'name',
        'slug',
        'description',
    ];

    public function group()
    {
        return $this->belongsTo(PermissionGroup::class, 'group_id');
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }
}
