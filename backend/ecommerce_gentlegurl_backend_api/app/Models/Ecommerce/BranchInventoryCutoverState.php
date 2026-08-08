<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class BranchInventoryCutoverState extends Model
{
    public const PENDING = 'pending';
    public const RECONCILED = 'reconciled';
    public const ACTIVE = 'active';

    protected $fillable = ['store_location_id', 'status', 'reconciled_at', 'activated_at', 'reconciliation_summary', 'updated_by_user_id'];

    protected $casts = [
        'reconciled_at' => 'datetime',
        'activated_at' => 'datetime',
        'reconciliation_summary' => 'array',
    ];

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
}
