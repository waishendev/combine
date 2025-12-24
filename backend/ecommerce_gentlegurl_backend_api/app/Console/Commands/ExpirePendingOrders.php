<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Order;
use App\Services\Ecommerce\OrderReserveService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpirePendingOrders extends Command
{
    protected $signature = 'ecommerce:expire-pending-orders';

    protected $description = 'Cancel pending unpaid orders past the reserve window and release stock.';

    public function __construct(protected OrderReserveService $orderReserveService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $reserveMinutes = $this->orderReserveService->getReserveMinutes();
        $cutoff = Carbon::now()->subMinutes($reserveMinutes);

        Order::where('status', 'pending')
            ->where('payment_status', 'unpaid')
            ->where('created_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(50, function ($orders) use ($cutoff) {
                foreach ($orders as $order) {
                    DB::transaction(function () use ($order, $cutoff) {
                        $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();

                        if (!$lockedOrder) {
                            return;
                        }

                        if ($lockedOrder->status !== 'pending' || $lockedOrder->payment_status !== 'unpaid') {
                            return;
                        }

                        if ($lockedOrder->created_at && $lockedOrder->created_at->greaterThanOrEqualTo($cutoff)) {
                            return;
                        }

                        $lockedOrder->status = 'cancelled';
                        $lockedOrder->save();

                        $this->orderReserveService->releaseStockForOrder($lockedOrder);
                    });
                }
            });

        return Command::SUCCESS;
    }
}
