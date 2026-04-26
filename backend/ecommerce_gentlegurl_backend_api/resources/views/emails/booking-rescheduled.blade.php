<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Rescheduled — {{ $bookingCode }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <!-- <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #fef3c7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 28px;">
                &#128197;
            </div>
        </div> -->

        <h1 style="color: #92400e; margin-top: 0; text-align: center;">Booking Rescheduled</h1>
        <p style="margin: 0 0 24px; text-align: center; color: #555;">
            Hi {{ $customerName }}, your booking has been rescheduled. Please see the updated details below.
        </p>

        <div style="padding: 16px; border: 1px solid #fde68a; border-radius: 8px; margin: 20px 0; background-color: #fffbeb;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Previous Schedule</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 4px; color: #92400e; width: 60px;">Date:</td>
                    <td style="padding: 4px; text-decoration: line-through; color: #b45309;">{{ $oldDate }}</td>
                </tr>
                <tr>
                    <td style="padding: 4px; color: #92400e;">Time:</td>
                    <td style="padding: 4px; text-decoration: line-through; color: #b45309;">{{ $oldStartTime }} - {{ $oldEndTime }}</td>
                </tr>
            </table>
        </div>

        <div style="padding: 20px; border: 2px solid #86efac; border-radius: 8px; margin: 20px 0; background-color: #f0fdf4;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">New Schedule</p>
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
                            {{ $addon['name'] }}<br>
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
                    <td style="padding: 8px 4px; font-weight: 600; color: #166534;">{{ $newDate }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666;">Time:</td>
                    <td style="padding: 8px 4px; font-weight: 600; color: #166534;">{{ $newStartTime }} - {{ $newEndTime }}</td>
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
            If you have any questions regarding this change, please contact us directly:<br>
            &#128242; Gentlegurls Nail Salon @ {{ $contactPhone }}
        </p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #888;">
            如果有任何预约上的疑问，请直接联系以上号码，请勿回复此信息
        </p>

        <p style="font-size: 13px; color: #888; margin: 24px 0 0; text-align: center;">
            This is an automated notification. Please do not reply to this message.
        </p>
    </div>
</body>
</html>
