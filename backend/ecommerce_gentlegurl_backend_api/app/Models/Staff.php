<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $table = 'staffs';

    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'phone',
        'email',
        'commission_rate',
        'service_commission_rate',
        'is_active',
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
}
