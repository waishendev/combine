<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosPaymentMethod extends Model
{
    protected $fillable = ['key', 'name', 'default_sort_order', 'is_system'];
    protected $casts = ['is_system' => 'boolean'];
}
