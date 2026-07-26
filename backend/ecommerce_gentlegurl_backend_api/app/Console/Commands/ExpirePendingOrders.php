<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Order;
use App\Services\Booking\CustomerServicePackageService;
use App\Services\Ecommerce\OrderReserveService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpirePendingOrders extends Command
{
    protected $signature = 'ecommerce:expire-pending-orders';

    protected $description = 'Cancel pending unpaid / rejected-proof orders past the reserve window and release stock.';

    public function __construct(protected OrderReserveService $orderReserveService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        Order::query()
            ->where('payment_status', 'unpaid')
            ->whereIn('status', ['pending', 'reject_payment_proof'])
            ->orderBy('id')
            ->chunkById(50, function ($orders) {
                foreach ($orders as $order) {
                    DB::transaction(function () use ($order) {
                        $lockedOrder = Order::where('id', $order->id)->lockForUpdate()->first();

                        if (! $lockedOrder) {
                            return;
                        }

                        if ($lockedOrder->payment_status !== 'unpaid') {
                            return;
                        }

                        $status = (string) $lockedOrder->status;

                        if ($status === 'pending') {
                            if (! $this->orderReserveService->isExpired($lockedOrder)) {
                                return;
                            }
                        } elseif ($status === 'reject_payment_proof') {
                            if (! $this->orderReserveService->isRejectReuploadExpired($lockedOrder)) {
                                return;
                            }
                        } else {
                            return;
                        }

                        $lockedOrder->status = 'cancelled';
                        $lockedOrder->save();

                        app(CustomerServicePackageService::class)->revokeUnpaidBookingPackagesForOrder($lockedOrder);
                        $this->orderReserveService->releaseStockForOrder($lockedOrder);
                    });
                }
            });

        return Command::SUCCESS;
    }
}
