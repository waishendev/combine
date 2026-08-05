<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Symfony\Component\Mime\Email;

class DailyLowStockSummaryMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<int, array{
     *   sku:string,
     *   name:string,
     *   cn_name?:string,
     *   variant_name?:string|null,
     *   variant_cn_name?:string|null,
     *   stock:int,
     *   threshold:int
     * }>  $products
     */
    public function __construct(
        private array $products,
        private string $date,
        private string $emailSubject = 'Inventory alert: low stock',
    ) {
    }

    public function build(): self
    {
        $outOfStock = collect($this->products)->filter(fn (array $p) => (int) ($p['stock'] ?? 0) <= 0)->count();
        $lowStock = count($this->products) - $outOfStock;

        $viewData = [
            'products' => $this->products,
            'date' => $this->date,
            'totalCount' => count($this->products),
            'outOfStockCount' => $outOfStock,
            'lowStockCount' => $lowStock,
        ];

        return $this->subject($this->emailSubject)
            ->view('emails.daily-low-stock-summary', $viewData)
            ->text('emails.daily-low-stock-summary-text', $viewData)
            ->withSymfonyMessage(function (Email $message): void {
                $headers = $message->getHeaders();

                // Transactional / system-alert signals (helps avoid Promotions)
                $headers->addTextHeader('Auto-Submitted', 'auto-generated');
                $headers->addTextHeader('X-Auto-Response-Suppress', 'All');
                $headers->addTextHeader('Precedence', 'auto_reply');
                $headers->addTextHeader('X-Entity-Type', 'transactional');

                // Disable Mailgun open/click tracking pixels (strong Promotions signal)
                $headers->addTextHeader('X-Mailgun-Track', 'no');
                $headers->addTextHeader('X-Mailgun-Track-Clicks', 'no');
                $headers->addTextHeader('X-Mailgun-Track-Opens', 'no');
                $headers->addTextHeader('X-Mailgun-Tag', 'inventory-low-stock-alert');
            });
    }
}
