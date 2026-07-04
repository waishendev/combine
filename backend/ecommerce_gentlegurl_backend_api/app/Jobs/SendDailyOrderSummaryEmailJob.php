<?php

namespace App\Jobs;

use App\Mail\DailyOrderSummaryMail;
use App\Models\Ecommerce\Order;
use App\Support\PendingEcommerceOrderQuery;
use App\Support\RequestCenterPendingTasksQuery;
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

        $orders = PendingEcommerceOrderQuery::pendingRequestOrders()
            ->with(['items.product', 'customer', 'serviceItems'])
            ->get();

        $ecommerceOrders = $orders->map(function (Order $order) {
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
                'order_kind' => PendingEcommerceOrderQuery::orderKind($order),
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'status_label' => PendingEcommerceOrderQuery::displayStatus($order),
                'customer_name' => $order->customer?->name ?? $order->shipping_name ?? 'N/A',
                'total_amount' => $order->grand_total ?? 0,
                'product_names' => $productNames,
            ];
        })->all();

        $bookingRequests = RequestCenterPendingTasksQuery::pendingBookingRequestRows()->all();

        $summary = [
            'date' => now()->toDateString(),
            'total_tasks' => count($ecommerceOrders) + count($bookingRequests),
            'total_ecommerce_orders' => count($ecommerceOrders),
            'total_booking_requests' => count($bookingRequests),
            'total_revenue' => $orders->sum('grand_total'),
            'ecommerce_orders' => $ecommerceOrders,
            'booking_requests' => $bookingRequests,
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
