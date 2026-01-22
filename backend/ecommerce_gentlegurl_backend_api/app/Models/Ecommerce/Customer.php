<?php

namespace App\Models\Ecommerce;

use App\Models\CustomerAddress;
use App\Notifications\CustomerResetPassword;
use App\Notifications\CustomerVerifyEmail;
use App\Services\MailgunService;
use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\HasApiTokens;
use DateTimeInterface;

class Customer extends Authenticatable implements MustVerifyEmailContract
{
    use HasApiTokens;
    use HasFactory;
    use MustVerifyEmail;
    use Notifiable;

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
        'email_verified_at',
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
            'email_verified_at' => 'datetime',
        ];
    }

    public function sendEmailVerificationNotification()
    {
        // 如果配置了使用 Mailgun SDK，则直接使用 MailgunService
        if (config('mail.default') === 'mailgun' && env('USE_MAILGUN_SDK', true)) {
            try {
                $mailgunService = app(MailgunService::class);
                
                // 生成验证 URL
                $backendUrl = URL::temporarySignedRoute(
                    'verification.verify',
                    now()->addMinutes(config('auth.verification.expire', 60)),
                    [
                        'id' => $this->getKey(),
                        'hash' => sha1($this->getEmailForVerification()),
                    ],
                );

                $frontendBase = rtrim(config('services.frontend_url') ?? config('app.url'), '/');
                $queryParams = [];
                $queryString = parse_url($backendUrl, PHP_URL_QUERY);

                if ($queryString) {
                    parse_str($queryString, $queryParams);
                }

                $queryParams = array_merge([
                    'id' => $this->getKey(),
                    'hash' => sha1($this->getEmailForVerification()),
                ], $queryParams);

                $verificationUrl = $frontendBase . '/verify-email?' . http_build_query($queryParams);
                
                // 构建邮件内容
                $subject = __('Verify Email Address');
                $html = view('emails.verify-email', [
                    'verificationUrl' => $verificationUrl,
                    'customer' => $this,
                ])->render();
                
                $text = __('Please click the following link to verify your email address:') . "\n\n" . $verificationUrl;
                
                // 发送邮件
                $result = $mailgunService->sendEmail(
                    $this->getEmailForVerification(),
                    $subject,
                    $html,
                    $text
                );
                
                if ($result && $result['success']) {
                    Log::info('Email verification sent via MailgunService', [
                        'customer_id' => $this->id,
                        'email' => $this->getEmailForVerification(),
                        'mailgun_id' => $result['id'] ?? null,
                        'mailgun_message' => $result['message'] ?? null,
                    ]);
                } else {
                    Log::error('Failed to send email verification via MailgunService', [
                        'customer_id' => $this->id,
                        'email' => $this->getEmailForVerification(),
                        'error' => $result['error'] ?? 'Unknown error',
                    ]);
                    // 回退到默认通知
                    $this->notify(new CustomerVerifyEmail());
                }
            } catch (\Exception $e) {
                Log::error('Exception in sendEmailVerificationNotification with MailgunService', [
                    'customer_id' => $this->id,
                    'email' => $this->getEmailForVerification(),
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                // 回退到默认通知
                $this->notify(new CustomerVerifyEmail());
            }
        } else {
            // 使用默认的通知系统
            $this->notify(new CustomerVerifyEmail());
        }
    }

    public function sendPasswordResetNotification($token)
    {
        $this->notify(new CustomerResetPassword($token));
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
