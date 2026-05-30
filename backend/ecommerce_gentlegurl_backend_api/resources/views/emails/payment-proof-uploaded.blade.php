<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Proof {{ $isReupload ? 'Re-uploaded' : 'Uploaded' }} — {{ $orderNumber }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
            @if ($isReupload)
            <div style="display: inline-block; background-color: #fef3c7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center;">
                <span style="font-size: 26px; color: #d97706;">&#9888;</span>
            </div>
            @else
            <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center;">
                <span style="font-size: 26px; color: #16a34a;">&#10003;</span>
            </div>
            @endif
        </div>

        <h1 style="color: {{ $isReupload ? '#92400e' : '#166534' }}; margin-top: 0; text-align: center; font-size: 22px;">
            Payment Proof {{ $isReupload ? 'Re-uploaded' : 'Uploaded' }}
        </h1>
        <p style="margin: 0 0 24px; text-align: center; color: #555;">
            A customer has {{ $isReupload ? 're-uploaded' : 'uploaded' }} a manual transfer payment slip. Please review and approve.
        </p>

        <div style="padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin: 20px 0; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 4px; color: #666; width: 120px; vertical-align: top;">Type:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $orderType }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Order / Booking:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $orderNumber }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Customer:</td>
                    <td style="padding: 8px 4px;">{{ $customerName }}</td>
                </tr>
                @if ($customerEmail)
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Email:</td>
                    <td style="padding: 8px 4px;">{{ $customerEmail }}</td>
                </tr>
                @endif
                @if ($customerPhone)
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Phone:</td>
                    <td style="padding: 8px 4px;">{{ $customerPhone }}</td>
                </tr>
                @endif
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Amount:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">RM {{ number_format($amount, 2) }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Uploaded At:</td>
                    <td style="padding: 8px 4px;">{{ $uploadedAt }}</td>
                </tr>
            </table>
        </div>

        <p style="margin: 20px 0 0; font-size: 14px; text-align: center; color: #555;">
            Please log in to the admin panel to review and approve this payment.
        </p>

        <p style="font-size: 13px; color: #888; margin: 24px 0 0; text-align: center;">
            This is an automated notification. Please do not reply to this message.
        </p>
    </div>
</body>
</html>
