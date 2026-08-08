<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class PosCart extends Model
{
    protected $fillable = [
        'staff_user_id',
        'store_location_id',
        'voucher_id',
        'customer_voucher_id',
        'voucher_code',
        'voucher_discount_amount',
        'voucher_snapshot',
    ];

    protected $casts = [
        'voucher_discount_amount' => 'decimal:2',
        'voucher_snapshot' => 'array',
    ];

    public function staffUser()
    {
        return $this->belongsTo(User::class, 'staff_user_id');
    }

    public function storeLocation()
    {
        return $this->belongsTo(StoreLocation::class);
    }

    public function hasMeaningfulState(): bool
    {
        return $this->items()->exists() || $this->serviceItems()->exists()
            || $this->packageItems()->exists() || $this->appointmentSettlementItems()->exists()
            || $this->voucher_id !== null || $this->customer_voucher_id !== null;
    }

    public function items()
    {
        return $this->hasMany(PosCartItem::class);
    }

    public function serviceItems()
    {
        return $this->hasMany(PosCartServiceItem::class);
    }

    public function packageItems()
    {
        return $this->hasMany(PosCartPackageItem::class);
    }

    public function appointmentSettlementItems()
    {
        return $this->hasMany(PosCartAppointmentSettlementItem::class, 'pos_cart_id');
    }
}
