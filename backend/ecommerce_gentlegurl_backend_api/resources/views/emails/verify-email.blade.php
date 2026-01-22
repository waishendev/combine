<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ __('Verify Email Address') }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">{{ __('Verify Email Address') }}</h1>
        
        <p>{{ __('Hello') }} {{ $customer->name }},</p>
        
        <p>{{ __('Please click the button below to verify your email address.') }}</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ $verificationUrl }}" 
               style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                {{ __('Verify Email Address') }}
            </a>
        </div>
        
        <p style="font-size: 12px; color: #666;">
            {{ __('If you did not create an account, no further action is required.') }}
        </p>
        
        <p style="font-size: 12px; color: #666; margin-top: 30px;">
            {{ __('If the button does not work, copy and paste this link into your browser:') }}<br>
            <a href="{{ $verificationUrl }}" style="color: #007bff; word-break: break-all;">{{ $verificationUrl }}</a>
        </p>
    </div>
</body>
</html>
