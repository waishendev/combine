<?php

namespace App\Jobs;

use App\Mail\DailyOrderSummaryMail;
use App\Models\Ecommerce\BranchNotificationSetting;
use App\Models\Ecommerce\Order;
use App\Support\PendingEcommerceOrderQuery;
use App\Support\RequestCenterPendingTasksQuery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

class SendDailyOrderSummaryEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $settings = BranchNotificationSetting::query()->with('storeLocation')
            ->where('daily_order_summary_enabled', true)->get();
        foreach ($settings as $setting) {
            if (! $this->isDue((string) $setting->daily_order_summary_send_at)) continue;
            $cacheKey = 'daily_order_summary_sent_'.$setting->store_location_id.'_'.now()->toDateString();
            if (Cache::has($cacheKey)) continue;
            Cache::put($cacheKey, true, now()->addDay());
            $summary = $this->summary((int) $setting->store_location_id, (string) $setting->storeLocation?->name);
            foreach ($this->validRecipients($setting->daily_order_summary_recipients ?? []) as $recipient) {
                Mail::to($recipient)->send(new DailyOrderSummaryMail($summary));
            }
        }
    }

    private function summary(int $branchId, string $branchName): array
    {
        $orders = PendingEcommerceOrderQuery::pendingRequestOrders()
            ->where(function ($query) use ($branchId) {
                $query->where('store_location_id', $branchId)
                    ->orWhereHas('items', fn ($items) => $items->where('fulfillment_store_location_id', $branchId))
                    ->orWhereHas('fulfillments', fn ($rows) => $rows->where('store_location_id', $branchId));
            })->with(['items.product', 'customer', 'serviceItems'])->get();
        $ecommerceOrders = $orders->map(function (Order $order) use ($branchId) {
            $branchItems = $order->items->where('fulfillment_store_location_id', $branchId);
            $hasExplicitFulfillment = $order->items->contains(fn ($item) => $item->fulfillment_store_location_id !== null);
            $branchSubtotal = $hasExplicitFulfillment
                ? $branchItems->sum(fn ($item) => (float) ($item->line_total_after_discount ?? $item->line_total ?? 0))
                : ((int) $order->store_location_id === $branchId ? (float) $order->grand_total : 0.0);
            $items = $hasExplicitFulfillment ? $branchItems : $order->items;
            return [
                'order_number' => $order->order_number ?? $order->id, 'order_kind' => PendingEcommerceOrderQuery::orderKind($order),
                'status' => $order->status, 'payment_status' => $order->payment_status,
                'status_label' => PendingEcommerceOrderQuery::displayStatus($order),
                'customer_name' => $order->customer?->name ?? $order->shipping_name ?? 'N/A',
                'total_amount' => $branchSubtotal, 'amount_label' => $hasExplicitFulfillment ? 'Branch fulfilment subtotal' : 'Order total',
                'product_names' => $items->map(fn ($item) => $item->product?->name ?? $item->product_name_snapshot)->filter()->unique()->values()->all(),
            ];
        })->all();
        $bookingRequests = RequestCenterPendingTasksQuery::pendingBookingRequestRows($branchId)->all();
        return [
            'date' => now()->toDateString(), 'branch_name' => $branchName,
            'total_tasks' => count($ecommerceOrders) + count($bookingRequests),
            'total_ecommerce_orders' => count($ecommerceOrders), 'total_booking_requests' => count($bookingRequests),
            'total_revenue' => collect($ecommerceOrders)->sum('total_amount'),
            'ecommerce_orders' => $ecommerceOrders, 'booking_requests' => $bookingRequests,
        ];
    }

    private function isDue(string $sendAt): bool
    {
        $scheduled = now()->copy()->startOfDay()->setTimeFromTimeString(substr($sendAt, 0, 5));
        return now()->betweenIncluded($scheduled, $scheduled->copy()->addMinutes(5));
    }

    private function validRecipients(array $recipients): array
    {
        return array_values(array_unique(array_filter($recipients, fn ($email) => is_string($email) && filter_var($email, FILTER_VALIDATE_EMAIL))));
    }
}
