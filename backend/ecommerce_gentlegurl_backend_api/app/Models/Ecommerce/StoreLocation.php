<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;
use App\Models\Staff;
use App\Models\Booking\BookingService;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;

class StoreLocation extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::creating(function (StoreLocation $location): void {
            if (! filled($location->code)) {
                $location->code = static::generateUniqueSystemCode();
            }
            if (! filled($location->display_code)) {
                $location->display_code = $location->code;
            }
        });

        static::created(function (StoreLocation $location): void {
            BranchNotificationSetting::query()->firstOrCreate(
                ['store_location_id' => $location->id],
                BranchNotificationSetting::initialValues()
            );
            PosCashPoolAccount::query()->firstOrCreate(
                ['store_location_id' => $location->id, 'code' => PosCashPoolAccount::DEFAULT_CODE],
                ['total_initial_cash' => 0, 'total_withdraw' => 0]
            );
            StoreLocationPosSetting::query()->firstOrCreate(['store_location_id' => $location->id]);

            // After inventory cutover is live, new Branches join as ACTIVE so Create Product /
            // Add Stock use Branch inventory without another activate script.
            if (BranchInventoryCutoverState::query()->where('status', BranchInventoryCutoverState::ACTIVE)->exists()) {
                BranchInventoryCutoverState::query()->updateOrCreate(
                    ['store_location_id' => $location->id],
                    [
                        'status' => BranchInventoryCutoverState::ACTIVE,
                        'reconciled_at' => now(),
                        'activated_at' => now(),
                        'reconciliation_summary' => [
                            'source' => 'store_location_created',
                            'joined_active_cutover' => true,
                        ],
                    ]
                );
            }
        });
        static::updating(function (StoreLocation $location): void {
            if ($location->isDirty('code')) {
                throw new \LogicException('Branch code is immutable after creation.');
            }
        });
    }

    protected $fillable = [
        'name',
        'code',
        'display_code',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postcode',
        'country',
        'phone',
        'is_active',
        'is_pickup_available',
        'is_review_available',
        'is_booking_available',
        'is_pos_available',
        'sort_order',
        'opening_hours',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_pickup_available' => 'boolean',
            'is_review_available' => 'boolean',
            'is_booking_available' => 'boolean',
            'is_pos_available' => 'boolean',
            'sort_order' => 'integer',
            'opening_hours' => 'array',
        ];
    }

    /** Public Branch label for UI (falls back to system code). */
    public function displayCodeLabel(): string
    {
        $display = trim((string) ($this->display_code ?? ''));

        return $display !== '' ? $display : (string) $this->code;
    }

    /** Compact Branch ref for nested API payloads (POS / booking / orders). */
    public function toBranchRef(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => (string) $this->name,
            'code' => (string) $this->code,
            'display_code' => $this->displayCodeLabel(),
        ];
    }

    /** SQL expression for public Branch label (safe in SELECT companions). */
    public static function sqlDisplayCodeExpr(string $tableAlias = 'branch'): string
    {
        return "COALESCE(NULLIF(TRIM({$tableAlias}.display_code), ''), {$tableAlias}.code)";
    }

    public static function generateUniqueSystemCode(): string
    {
        do {
            $code = 'BR'.strtoupper(\Illuminate\Support\Str::random(8));
        } while (static::query()->where('code', $code)->exists());

        return $code;
    }

    public function images()
    {
        return $this->hasMany(StoreLocationImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'store_location_user')
            ->withTimestamps();
    }

    public function staffs()
    {
        return $this->belongsToMany(Staff::class, 'staff_store_location')->withTimestamps();
    }

    public function bookingServices()
    {
        return $this->belongsToMany(BookingService::class, 'booking_service_store_location')->withTimestamps();
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'store_location_product')
            ->withPivot('is_available')->withTimestamps();
    }

    public function productInventories()
    {
        return $this->hasMany(StoreLocationProductInventory::class);
    }

    public function posSettings()
    {
        return $this->hasOne(StoreLocationPosSetting::class);
    }

    public function notificationSettings()
    {
        return $this->hasOne(BranchNotificationSetting::class);
    }

    public function cashPoolAccounts()
    {
        return $this->hasMany(PosCashPoolAccount::class);
    }

    /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
     */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
