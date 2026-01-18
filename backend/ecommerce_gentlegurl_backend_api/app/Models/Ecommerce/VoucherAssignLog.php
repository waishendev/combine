<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VoucherAssignLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'voucher_id',
        'assigned_by_admin_id',
        'quantity',
        'start_at',
        'end_at',
        'note',
        'assigned_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'assigned_at' => 'datetime',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'assigned_by_admin_id');
    }
}
