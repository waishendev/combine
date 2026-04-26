<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Reminder — {{ $appointmentDate }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <p style="margin: 20px 0 0; font-size: 15px;">
            Hi <strong>{{ $customerName }}</strong>,
        </p>

        <p style="margin: 12px 0 0; font-size: 15px;">
            You've got an appointment with us tomorrow. 您的预约在明天哦！
        </p>

        <div style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin: 24px 0; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 4px; color: #666; width: 100px; vertical-align: top;">Service:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $serviceName }}</td>
                </tr>
                @if (!empty($addonItems))
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Add-Ons:</td>
                    <td style="padding: 8px 4px;">
                        @foreach ($addonItems as $addon)
                            {{ $addon['name'] }} <br>
                        @endforeach
                    </td>
                </tr>
                @else
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Add-Ons:</td>
                    <td style="padding: 8px 4px; color: #999;">-</td>
                </tr>
                @endif
                @if ($staffName)
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Staff:</td>
                    <td style="padding: 8px 4px;">{{ $staffName }}</td>
                </tr>
                @endif
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Date:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $appointmentDate }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Time:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $appointmentStartTime }} - {{ $appointmentEndTime }}</td>
                </tr>
                @if ($durationMin > 0)
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Duration:</td>
                    <td style="padding: 8px 4px;">{{ $durationMin }} minutes</td>
                </tr>
                @endif
            </table>
        </div>

        <p style="margin: 20px 0 0; font-size: 14px;">
            If you got any question regarding the appointment, please contact us directly:<br>
            &#128242; Gentlegurls Nail Salon @ {{ $contactPhone }}
        </p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #888;">
            如果有任何预约上的疑问，请直接联系以上号码，请勿回复此信息
        </p>

        <p style="margin: 28px 0 0; font-size: 15px;">
            See you tomorrow! 明天见&#10024;
        </p>
    </div>
</body>
</html>
