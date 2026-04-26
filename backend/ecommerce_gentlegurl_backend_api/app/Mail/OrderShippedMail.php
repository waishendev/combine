<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderShippedMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array<int, array{name:string,qty:int,line_total:float}> $items
     */
    public function __construct(
        private string $customerName,
        private string $orderNumber,
        private string $shippingCourier,
        private string $trackingNo,
        private string $shippedAt,
        private string $shippingName,
        private string $shippingPhone,
        private string $shippingAddress,
        private float $grandTotal,
        private array $items = [],
        private string $contactPhone = '010-387 0881',
    ) {
        $this->customerName = mb_scrub($this->customerName, 'UTF-8');
        $this->orderNumber = mb_scrub($this->orderNumber, 'UTF-8');
        $this->shippingCourier = mb_scrub($this->shippingCourier, 'UTF-8');
        $this->trackingNo = mb_scrub($this->trackingNo, 'UTF-8');
        $this->shippedAt = mb_scrub($this->shippedAt, 'UTF-8');
        $this->shippingName = mb_scrub($this->shippingName, 'UTF-8');
        $this->shippingPhone = mb_scrub($this->shippingPhone, 'UTF-8');
        $this->shippingAddress = mb_scrub($this->shippingAddress, 'UTF-8');
        $this->contactPhone = mb_scrub($this->contactPhone, 'UTF-8');
        $this->items = array_map(
            fn (array $item): array => [
                'name' => mb_scrub((string) ($item['name'] ?? ''), 'UTF-8'),
                'qty' => (int) ($item['qty'] ?? 0),
                'line_total' => (float) ($item['line_total'] ?? 0),
            ],
            $this->items
        );
    }

    public function build(): self
    {
        return $this->subject('Your Order Has Been Shipped — ' . $this->orderNumber)
            ->view('emails.order-shipped', [
                'customerName' => $this->customerName,
                'orderNumber' => $this->orderNumber,
                'shippingCourier' => $this->shippingCourier,
                'trackingNo' => $this->trackingNo,
                'shippedAt' => $this->shippedAt,
                'shippingName' => $this->shippingName,
                'shippingPhone' => $this->shippingPhone,
                'shippingAddress' => $this->shippingAddress,
                'grandTotal' => $this->grandTotal,
                'items' => $this->items,
                'contactPhone' => $this->contactPhone,
            ]);
    }
}
