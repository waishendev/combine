<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>How was your visit?</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <p style="margin: 0 0 16px; font-size: 15px;">
            Dear <strong>{{ $customerName }}</strong>,
        </p>

        <p style="margin: 0 0 12px; font-size: 15px;">
            Thanks for visiting <strong>Gentlegurls / Cutie Candie by Gentlegurls</strong> Nail Salon!
        </p>

        <p style="margin: 0 0 12px; font-size: 15px;">
            Just a quick little check-in — was everything okay for you today? 😊
        </p>

        <div style="padding: 16px 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin: 20px 0; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                @if ($serviceName)
                <tr>
                    <td style="padding: 6px 4px; color: #666; width: 100px; vertical-align: top;">Service:</td>
                    <td style="padding: 6px 4px; font-weight: 600;">{{ $serviceName }}</td>
                </tr>
                @endif
                @if (!empty($addonItems))
                <tr>
                    <td style="padding: 6px 4px; color: #666; vertical-align: top;">Add-Ons:</td>
                    <td style="padding: 6px 4px;">
                        @foreach ($addonItems as $addon)
                            {{ $addon['name'] }}@if ($addon['extra_price'] > 0) (RM {{ number_format($addon['extra_price'], 2) }})@endif<br>
                        @endforeach
                    </td>
                </tr>
                @else
                <tr>
                    <td style="padding: 6px 4px; color: #666;">Add-Ons:</td>
                    <td style="padding: 6px 4px; color: #999;">-</td>
                </tr>
                @endif
                @if ($staffName)
                <tr>
                    <td style="padding: 6px 4px; color: #666; vertical-align: top;">Staff:</td>
                    <td style="padding: 6px 4px;">{{ $staffName }}</td>
                </tr>
                @endif
                @if ($appointmentDate)
                <tr>
                    <td style="padding: 6px 4px; color: #666; vertical-align: top;">Date:</td>
                    <td style="padding: 6px 4px;">{{ $appointmentDate }}</td>
                </tr>
                @endif
                @if ($appointmentStartTime)
                <tr>
                    <td style="padding: 6px 4px; color: #666; vertical-align: top;">Time:</td>
                    <td style="padding: 6px 4px; font-weight: 600;">{{ $appointmentStartTime }} - {{ $appointmentEndTime }}</td>
                </tr>
                @endif
                @if ($durationMin > 0)
                <tr>
                    <td style="padding: 6px 4px; color: #666; vertical-align: top;">Duration:</td>
                    <td style="padding: 6px 4px;">{{ $durationMin }} minutes</td>
                </tr>
                @endif
            </table>
        </div>

        <p style="margin: 0 0 12px; font-size: 15px;">
            If anything didn't go quite right, feel free to let us know anytime. We're always here to make things better 💬💛
        </p>

        <div style="text-align: center; margin: 28px 0;">
            <a href="{{ $whatsappUrl }}" target="_blank" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px;">
                Chat with us on WhatsApp
            </a>
        </div>

        <p style="margin: 0 0 4px; font-size: 14px; color: #666;">
            Or contact us directly: Gentlegurls Nail Salon @ {{ $contactPhone }}
        </p>
        <p style="margin: 0 0 0; font-size: 13px; color: #888;">
            如果有任何服务上的疑问或反馈，请直接联系以上号码，请勿回复此信息
        </p>

        <p style="font-size: 13px; color: #888; margin: 24px 0 0; text-align: center;">
            This is an automated notification. Please do not reply to this message.
        </p>
    </div>
</body>
</html>
