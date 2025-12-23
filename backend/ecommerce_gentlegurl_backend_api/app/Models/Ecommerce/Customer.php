<?php

namespace App\Models\Ecommerce;

use App\Models\CustomerAddress;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use DateTimeInterface;

class Customer extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'tier',
        'tier_marked_pending_at',
        'tier_effective_at',
        'is_active',
        'last_login_at',
        'last_login_ip',
        'avatar',
        'gender',
        'date_of_birth',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'tier_marked_pending_at' => 'datetime',
            'tier_effective_at' => 'datetime',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'date_of_birth' => 'date',
        ];
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function pointsEarnBatches()
    {
        return $this->hasMany(PointsEarnBatch::class);
    }

    public function redemptions()
    {
        return $this->hasMany(PointsRedemption::class);
    }

    public function pointsTransactions()
    {
        return $this->hasMany(PointsTransaction::class);
    }

    public function loyaltyRedemptions()
    {
        return $this->hasMany(LoyaltyRedemption::class);
    }

    public function wishlistItems()
    {
        return $this->belongsToMany(Product::class, 'customer_wishlist_items')
            ->withPivot(['created_at']);
    }

    public function customerVouchers()
    {
        return $this->hasMany(CustomerVoucher::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function defaultShippingAddress(): HasOne
    {
        return $this->hasOne(CustomerAddress::class)
            ->where('type', 'shipping')
            ->where('is_default', true);
    }

    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
