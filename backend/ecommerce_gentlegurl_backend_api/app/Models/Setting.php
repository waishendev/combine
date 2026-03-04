<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['type', 'key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];
}
