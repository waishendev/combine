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
     *   total_orders:int,
     *   total_revenue:float|int|string,
     *   orders:array<int, array{
     *     order_number:string|int|null,
     *     order_kind:string,
     *     status:string|null,
     *     payment_status:string|null,
     *     status_label:string,
     *     customer_name:string|null,
     *     total_amount:float|int|string|null,
     *     product_names:array<int, string>
     *   }>
     * } $summary
     */
    public function __construct(private array $summary)
    {
    }

    public function build(): self
    {
        return $this->subject('Daily Pending Orders Summary')
            ->view('emails.daily-order-summary', [
                'summary' => $this->summary,
            ]);
    }
}
