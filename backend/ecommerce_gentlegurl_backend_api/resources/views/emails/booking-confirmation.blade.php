<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmed — {{ $bookingCode }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 28px;">
                &#10003;
            </div>
        </div>

        <h1 style="color: #166534; margin-top: 0; text-align: center;">Booking Confirmed</h1>
        <p style="margin: 0 0 24px; text-align: center; color: #555;">
            Hi {{ $customerName }}, your booking has been confirmed. Please see the details below.
        </p>

        <div style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin: 20px 0; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 4px; color: #666; width: 140px;">Booking Ref:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $bookingCode }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Service:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $serviceName }}</td>
                </tr>
                @if (!empty($addonItems))
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Add-Ons:</td>
                    <td style="padding: 8px 4px;">
                        <ul style="margin: 0; padding: 0 0 0 16px;">
                            @foreach ($addonItems as $addon)
                                <li style="margin: 0; padding: 0;">
                                    <span style="display: inline-block; background-color: #f3f4f6; border-radius: 4px; padding: 2px 8px; margin: 2px 0; font-size: 13px;">{{ $addon['name'] }}</span>
                                </li>
                            @endforeach
                        </ul>
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
                @if ($depositAmount > 0)
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Deposit Paid:</td>
                    <td style="padding: 8px 4px;">RM {{ number_format($depositAmount, 2) }}</td>
                </tr>
                @endif
            </table>
        </div>

        <div style="background-color: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 600; color: #854d0e;">&#128197; Reminder</p>
            <p style="margin: 8px 0 0; color: #854d0e;">
                Please arrive on time for your appointment on <strong>{{ $appointmentDate }}</strong> at <strong>{{ $appointmentStartTime }}</strong>.
                If you need to reschedule or cancel, please contact us directly.
            </p>
            <p style="margin: 10px 0 0; font-size: 14px; color: #854d0e;">
                &#128242; Gentlegurls Nail Salon @ {{ $contactPhone }}
            </p>
        </div>

        <p style="font-size: 13px; color: #888; margin: 24px 0 0; text-align: center;">
            This is an automated confirmation email. Please do not reply to this message.
        </p>
    </div>
</body>
</html>
