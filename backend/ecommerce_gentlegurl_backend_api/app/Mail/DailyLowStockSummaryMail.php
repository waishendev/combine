<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

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
        private string $emailSubject = 'Daily Low Stock Summary',
    ) {
    }

    public function build(): self
    {
        $outOfStock = collect($this->products)->filter(fn (array $p) => (int) ($p['stock'] ?? 0) <= 0)->count();
        $lowStock = count($this->products) - $outOfStock;

        return $this->subject($this->emailSubject)
            ->view('emails.daily-low-stock-summary', [
                'products' => $this->products,
                'date' => $this->date,
                'totalCount' => count($this->products),
                'outOfStockCount' => $outOfStock,
                'lowStockCount' => $lowStock,
            ]);
    }
}
