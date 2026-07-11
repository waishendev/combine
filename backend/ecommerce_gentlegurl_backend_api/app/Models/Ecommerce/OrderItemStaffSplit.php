<?php

namespace App\Models\Ecommerce;

use App\Models\Staff;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItemStaffSplit extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_item_id',
        'line_type',
        'line_ref_id',
        'staff_id',
        'share_percent',
        'share_amount',
        'split_mode',
        'amount_basis',
        'snapshot',
        'commission_rate_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'integer',
            'share_amount' => 'decimal:2',
            'commission_rate_snapshot' => 'decimal:4',
            'amount_basis' => 'decimal:2',
            'snapshot' => 'array',
        ];
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function staff()
    {
        return $this->belongsTo(Staff::class);
    }
}
