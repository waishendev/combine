<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PosCashShift extends Model
{
    use HasFactory;

    public const STATUS_OPEN = 'OPEN';
    public const STATUS_CLOSED = 'CLOSED';

    protected $fillable = [
        'opening_amount',
        'opened_by',
        'opened_at',
        'closing_amount',
        'closed_by',
        'closed_at',
        'status',
        'remark',
    ];

    protected function casts(): array
    {
        return [
            'opening_amount' => 'decimal:2',
            'opened_at' => 'datetime',
            'closing_amount' => 'decimal:2',
            'closed_at' => 'datetime',
        ];
    }

    public function opener()
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closer()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
