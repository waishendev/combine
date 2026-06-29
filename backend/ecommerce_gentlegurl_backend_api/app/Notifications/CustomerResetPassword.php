<?php

namespace App\Notifications;

use App\Support\FrontendUrlResolver;
use Illuminate\Auth\Notifications\ResetPassword;

class CustomerResetPassword extends ResetPassword
{
    public function __construct(
        #[\SensitiveParameter] $token,
        protected ?string $frontendBaseUrl = null,
    ) {
        parent::__construct($token);
    }

    protected function resetUrl($notifiable)
    {
        $frontendBase = $this->frontendBaseUrl ?? FrontendUrlResolver::resolveBaseUrl();

        return $frontendBase . '/reset-password?' . http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}
