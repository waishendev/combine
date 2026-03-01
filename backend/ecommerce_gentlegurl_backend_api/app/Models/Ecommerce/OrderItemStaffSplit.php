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
        'staff_id',
        'share_percent',
        'commission_rate_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'integer',
            'commission_rate_snapshot' => 'decimal:4',
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
