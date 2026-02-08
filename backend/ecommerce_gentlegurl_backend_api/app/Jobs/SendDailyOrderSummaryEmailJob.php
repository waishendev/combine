<?php

namespace App\Jobs;

use App\Mail\DailyOrderSummaryMail;
use App\Models\Ecommerce\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendDailyOrderSummaryEmailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function handle(): void
    {
        $recipients = $this->getRecipients();

        if (empty($recipients)) {
            return;
        }

        $orders = Order::query()
            ->where(function ($query) {
                $query
                    ->where(function ($subQuery) {
                        $subQuery->where('status', 'pending')
                            ->where('payment_status', 'unpaid');
                    })
                    ->orWhere(function ($subQuery) {
                        $subQuery->where('status', 'processing')
                            ->where('payment_status', 'unpaid');
                    })
                    ->orWhere(function ($subQuery) {
                        $subQuery->where('status', 'reject_payment_proof')
                            ->where('payment_status', 'unpaid');
                    })
                    ->orWhere(function ($subQuery) {
                        $subQuery->where('status', 'processing')
                            ->where('payment_status', 'paid');
                    });
            })
            ->with(['items.product', 'customer'])
            ->get();

        $ordersData = $orders->map(function (Order $order) {
            $productNames = $order->items
                ->map(function ($item) {
                    return $item->product?->name
                        ?? $item->product_name_snapshot
                        ?? null;
                })
                ->filter()
                ->unique()
                ->values()
                ->all();

            return [
                'order_number' => $order->order_number ?? $order->id,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'customer_name' => $order->customer?->name ?? $order->shipping_name ?? 'N/A',
                'total_amount' => $order->grand_total ?? 0,
                'product_names' => $productNames,
            ];
        })->all();

        $summary = [
            'date' => now()->toDateString(),
            'total_orders' => count($ordersData),
            'total_revenue' => $orders->sum('grand_total'),
            'orders' => $ordersData,
        ];

        foreach ($recipients as $recipient) {
            Mail::to($recipient)->send(new DailyOrderSummaryMail($summary));
        }
    }

    /**
     * @return array<int, string>
     */
    private function getRecipients(): array
    {
        $rawEmails = env('NOTIFY_ADMIN_EMAILS', '');

        if ($rawEmails === '') {
            return [];
        }

        $emails = array_map('trim', explode(',', $rawEmails));
        $emails = array_filter($emails, fn ($email) => $email !== '');
        $emails = array_unique($emails);

        return array_values(array_filter($emails, fn ($email) => filter_var($email, FILTER_VALIDATE_EMAIL)));
    }
}
