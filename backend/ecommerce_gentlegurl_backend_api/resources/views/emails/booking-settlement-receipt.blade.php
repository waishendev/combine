<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking · Final Settlement — {{ $bookingReference }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">Booking · Final Settlement</h1>
        <p style="margin: 0 0 20px;">Your appointment payment is complete.</p>

        <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 6px; margin: 20px 0; background-color: #ffffff;">
            <p style="margin: 0 0 8px;"><strong>Order Number:</strong> {{ $orderNumber }}</p> 
            <p style="margin: 0 0 8px;"><strong>Booking reference:</strong> {{ $bookingReference }}</p>
            <p style="margin: 0 0 8px;"><strong>Appointment:</strong> {{ $appointmentAt }}</p>

            <p style="margin: 0 0 8px;"><strong>Date/Time:</strong> {{ $placedAt }}</p>
            <p style="margin: 0 0 8px;"><strong>Payment Method:</strong> {{ $paymentMethodDisplay }}</p>
            <p style="margin: 0 0 8px;"><strong>Status:</strong> {{ $paymentStatusDisplay }}</p>
            <p style="margin: 0;"><strong>Total Amount:</strong> RM {{ number_format((float) $totalAmount, 2) }}</p>
        </div>

        @if (!empty($items))
            <h2 style="color: #333;">Purchased Items</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th style="text-align:left; border-bottom: 1px solid #ddd; padding: 8px 4px;">Item</th>
                        <th style="text-align:center; border-bottom: 1px solid #ddd; padding: 8px 4px; width: 70px;">Qty</th>
                        <th style="text-align:right; border-bottom: 1px solid #ddd; padding: 8px 4px; width: 120px;">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $item)
                        <tr>
                            <td style="padding: 8px 4px; border-bottom: 1px solid #efefef;">{{ $item['name'] }}</td>
                            <td style="padding: 8px 4px; border-bottom: 1px solid #efefef; text-align:center;">{{ $item['qty'] }}</td>
                            <td style="padding: 8px 4px; border-bottom: 1px solid #efefef; text-align:right;">RM {{ number_format((float) $item['line_total'], 2) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif

        <p style="margin: 0 0 10px;">
            <a href="{{ $receiptUrl }}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600;">
                View Receipt
            </a>
        </p>
        <!-- <p style="font-size: 13px; color: #666; margin: 0 0 4px;">Receipt link (copy if the button does not open):</p>
        <p style="font-size: 13px; color: #2563eb; margin: 0; word-break: break-all;">{{ $receiptUrl }}</p> -->
    </div>
</body>
</html>
