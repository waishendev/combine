<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class PosCart extends Model
{
    protected $fillable = [
        'staff_user_id',
    ];

    public function staffUser()
    {
        return $this->belongsTo(User::class, 'staff_user_id');
    }

    public function items()
    {
        return $this->hasMany(PosCartItem::class);
    }
}
