<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class DailyOrderSummaryMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param array{
     *   date:string,
     *   total_tasks:int,
     *   total_ecommerce_orders:int,
     *   total_booking_requests:int,
     *   total_revenue:float|int|string,
     *   ecommerce_orders:array<int, array{
     *     order_number:string|int|null,
     *     order_kind:string,
     *     status:string|null,
     *     payment_status:string|null,
     *     status_label:string,
     *     customer_name:string|null,
     *     total_amount:float|int|string|null,
     *     product_names:array<int, string>
     *   }>,
     *   booking_requests:array<int, array{
     *     key:string,
     *     request_type:string,
     *     reference:string,
     *     customer_name:string,
     *     contact:string,
     *     requested_at:?string,
     *     status:string,
     *     reason:?string
     *   }>
     * } $summary
     */
    public function __construct(private array $summary)
    {
    }

    public function build(): self
    {
        return $this->subject('Current Pending Orders Summary')
            ->view('emails.daily-order-summary', [
                'summary' => $this->summary,
            ]);
    }
}
