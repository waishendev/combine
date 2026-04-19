<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class OrderActionLog extends Model
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'action_type',
        'before_value',
        'after_value',
        'remark',
        'created_by',
    ];

    protected $casts = [
        'before_value' => 'array',
        'after_value' => 'array',
    ];
}
