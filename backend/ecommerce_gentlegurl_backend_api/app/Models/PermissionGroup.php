<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class PermissionGroup extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'name',
        'sort_order',
    ];

    public function permissions()
    {
        return $this->hasMany(Permission::class, 'group_id');
    }
}
