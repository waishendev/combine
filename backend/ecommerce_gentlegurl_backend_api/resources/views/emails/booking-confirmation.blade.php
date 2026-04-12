<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - {{ $bookingNumber }}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 700px; margin: 0 auto; padding: 20px;">
<div style="background-color: #f9fafb; padding: 24px; border-radius: 8px;">
    <h1 style="color: #111827; margin-top: 0;">Your booking is confirmed 🎉</h1>
    <p>Hi {{ $customerName }}, your booking has been successfully created and paid.</p>

    <div style="padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; margin: 20px 0; background-color: #ffffff;">
        <p style="margin: 0 0 8px;"><strong>Booking Number:</strong> {{ $bookingNumber }}</p>
        @if ($bookingDate)
            <p style="margin: 0 0 8px;"><strong>Booking Date:</strong> {{ $bookingDate }}</p>
        @endif
        @if ($bookingTime)
            <p style="margin: 0 0 8px;"><strong>Booking Time:</strong> {{ $bookingTime }}</p>
        @endif
        @if ($staffName)
            <p style="margin: 0 0 8px;"><strong>Selected Staff:</strong> {{ $staffName }}</p>
        @endif
        @if ($branchName)
            <p style="margin: 0 0 8px;"><strong>Branch:</strong> {{ $branchName }}</p>
        @endif
        <p style="margin: 0 0 8px;"><strong>Payment Method:</strong> {{ $paymentMethod }}</p>
        <p style="margin: 0 0 8px;"><strong>Total Paid:</strong> RM {{ number_format((float) $totalAmountPaid, 2) }}</p>
        <p style="margin: 0 0 8px;"><strong>Booking Status:</strong> {{ $bookingStatus }}</p>
        <p style="margin: 0;"><strong>Payment Status:</strong> {{ $paymentStatusMessage }}</p>
    </div>

    @if (!empty($services))
        <h2 style="color: #111827; margin-bottom: 8px;">Service(s)</h2>
        <ul style="margin-top: 0;">
            @foreach ($services as $serviceName)
                <li>{{ $serviceName }}</li>
            @endforeach
        </ul>
    @endif

    @if (!empty($addons))
        <h2 style="color: #111827; margin-bottom: 8px;">Add-on(s)</h2>
        <ul style="margin-top: 0;">
            @foreach ($addons as $addonName)
                <li>{{ $addonName }}</li>
            @endforeach
        </ul>
    @endif

    <p style="font-size: 13px; color: #4b5563; margin-top: 24px;">Please keep this email as your booking confirmation.</p>
</div>
</body>
</html>
