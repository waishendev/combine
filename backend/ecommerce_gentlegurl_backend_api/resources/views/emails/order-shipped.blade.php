<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Shipped — {{ $orderNumber }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #dbeafe; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 28px;">
                &#128230;
            </div>
        </div>

        <h1 style="color: #1e40af; margin-top: 0; text-align: center;">Your Order Has Been Shipped!</h1>
        <p style="margin: 0 0 24px; text-align: center; color: #555;">
            Hi {{ $customerName }}, great news — your order <strong>{{ $orderNumber }}</strong> is on its way!
        </p>

        <div style="padding: 20px; border: 2px solid #93c5fd; border-radius: 8px; margin: 20px 0; background-color: #eff6ff;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #1e40af; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Details</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 4px; color: #666; width: 130px; vertical-align: top;">Order No:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $orderNumber }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Courier:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $shippingCourier }}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Tracking No:</td>
                    <td style="padding: 8px 4px; font-weight: 600;">{{ $trackingNo }}</td>
                </tr>
                @if ($shippedAt)
                <tr>
                    <td style="padding: 8px 4px; color: #666; vertical-align: top;">Shipped At:</td>
                    <td style="padding: 8px 4px;">{{ $shippedAt }}</td>
                </tr>
                @endif
            </table>
        </div>

        @if (!empty($items))
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; background-color: #fff;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Items in Your Order</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <th style="padding: 8px 4px; text-align: left; color: #666; font-size: 12px; font-weight: 600;">Item</th>
                        <th style="padding: 8px 4px; text-align: center; color: #666; font-size: 12px; font-weight: 600; width: 50px;">Qty</th>
                        <th style="padding: 8px 4px; text-align: right; color: #666; font-size: 12px; font-weight: 600; width: 100px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $item)
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px 4px;">{{ $item['name'] }}</td>
                        <td style="padding: 8px 4px; text-align: center;">{{ $item['qty'] }}</td>
                        <td style="padding: 8px 4px; text-align: right;">RM {{ number_format($item['line_total'], 2) }}</td>
                    </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #e5e7eb;">
                        <td colspan="2" style="padding: 10px 4px; font-weight: 600; text-align: right;">Total:</td>
                        <td style="padding: 10px 4px; font-weight: 600; text-align: right;">RM {{ number_format($grandTotal, 2) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        @endif

        @if ($shippingName || $shippingAddress)
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; background-color: #fff;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Delivery Address</p>
            @if ($shippingName)
            <p style="margin: 0 0 4px; font-weight: 600;">{{ $shippingName }}</p>
            @endif
            @if ($shippingPhone)
            <p style="margin: 0 0 4px; color: #666;">{{ $shippingPhone }}</p>
            @endif
            @if ($shippingAddress)
            <p style="margin: 0; color: #666;">{{ $shippingAddress }}</p>
            @endif
        </div>
        @endif

        <p style="margin: 20px 0 0; font-size: 14px;">
            If you have any questions about your delivery, please contact us directly:<br>
            &#128242; Gentlegurls Nail Salon @ {{ $contactPhone }}
        </p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #888;">
            如果有任何配送上的疑问，请直接联系以上号码，请勿回复此信息
        </p>

        <p style="font-size: 13px; color: #888; margin: 24px 0 0; text-align: center;">
            This is an automated notification. Please do not reply to this message.
        </p>
    </div>
</body>
</html>
