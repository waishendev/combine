<?php

namespace App\Notifications;

use App\Support\FrontendUrlResolver;
use Illuminate\Auth\Notifications\ResetPassword;

class CustomerResetPassword extends ResetPassword
{
    protected function resetUrl($notifiable)
    {
        $frontendBase = FrontendUrlResolver::resolveBaseUrl();

        return $frontendBase . '/reset-password?' . http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}
