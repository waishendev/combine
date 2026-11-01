<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PosCashShift;
use App\Models\User;
use App\Services\Ecommerce\OfflineOrderManagementService;
use App\Services\Ecommerce\PosCashShiftCashSalesService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-off: void POS-20261031201714-F226D9 (QR Pay RM 85 settlement).
 * Cash Sales is unaffected because this order has no cash payment rows.
 *
 * Usage:
 *   php artisan pos:one-off-void-f226d9
 *   php artisan pos:one-off-void-f226d9 --force
 */
class OneOffVoidPosOrderF226D9Command extends Command
{
    protected $signature = 'pos:one-off-void-f226d9
        {--force : Actually void the order (default is dry-run)}
        {--actor-email= : Optional actor email for action log (defaults to infra_core_x1 if present)}';

    protected $description = 'One-off void for POS-20261031201714-F226D9 (QR Pay RM85); does not touch cash shift snapshots';

    private const ORDER_NUMBER = 'POS-20261031201714-F226D9';

    private const REMARK = 'ONE-OFF infra void POS-20261031201714-F226D9 (QR Pay RM85; cash sales unchanged)';

    public function handle(
        OfflineOrderManagementService $voidService,
        PosCashShiftCashSalesService $cashSalesService,
    ): int {
        $order = Order::query()
            ->where('order_number', self::ORDER_NUMBER)
            ->with(['payments', 'items'])
            ->first();

        if (! $order) {
            $this->error('Order not found: '.self::ORDER_NUMBER);

            return self::FAILURE;
        }

        $cashPaid = round((float) $order->payments
            ->filter(fn ($p) => strtolower(trim((string) $p->payment_method)) === 'cash')
            ->sum(fn ($p) => (float) $p->amount), 2);

        $payments = $order->payments->map(fn ($p) => [
            'method' => $p->payment_method,
            'amount' => (float) $p->amount,
        ])->values()->all();

        $this->info('Order: '.$order->order_number.' (id='.$order->id.')');
        $this->line('Status: '.$order->status);
        $this->line('Grand total: RM '.number_format((float) $order->grand_total, 2));
        $this->line('Payments: '.json_encode($payments));
        $this->line('Cash portion: RM '.number_format($cashPaid, 2));
        $this->line('Store location id: '.(string) $order->store_location_id);
        $this->line('Paid at: '.(string) $order->paid_at);

        if ($order->status === 'voided') {
            $this->warn('Already voided. Nothing to do.');

            return self::SUCCESS;
        }

        if ($cashPaid > 0.0001) {
            $this->error('Abort: order has cash payments. This one-off command only proceeds when cash portion is 0 so Cash Sales stays unchanged.');

            return self::FAILURE;
        }

        $openShift = PosCashShift::query()
            ->where('store_location_id', (int) $order->store_location_id)
            ->where('event_type', PosCashShift::EVENT_OPEN)
            ->where('status', PosCashShift::STATUS_OPEN)
            ->whereNull('closed_at')
            ->orderByDesc('opened_at')
            ->first();

        $cashBefore = null;
        if ($openShift) {
            $cashBefore = $cashSalesService->compute(
                $openShift->opened_at,
                now(),
                (int) $order->store_location_id,
            );
            $this->line(sprintf(
                'Open shift #%d since %s — live Cash Sales BEFORE: RM %s',
                $openShift->id,
                (string) $openShift->opened_at,
                number_format($cashBefore, 2),
            ));
        } else {
            $this->line('No open cash shift for this branch (ok for QR-only void).');
        }

        $closedSnapshots = PosCashShift::query()
            ->where('store_location_id', (int) $order->store_location_id)
            ->where('event_type', PosCashShift::EVENT_CLOSE)
            ->whereNotNull('cash_sales_snapshot')
            ->whereDate('closed_at', '>=', '2026-10-30')
            ->whereDate('closed_at', '<=', '2026-11-02')
            ->orderBy('closed_at')
            ->get(['id', 'closed_at', 'cash_sales_snapshot', 'closing_withdraw']);

        $this->table(
            ['close_id', 'closed_at', 'cash_sales_snapshot', 'withdraw'],
            $closedSnapshots->map(fn ($s) => [
                $s->id,
                (string) $s->closed_at,
                number_format((float) $s->cash_sales_snapshot, 2),
                $s->closing_withdraw === null ? '—' : number_format((float) $s->closing_withdraw, 2),
            ])->all(),
        );

        $preview = $voidService->buildVoidOrderPreview($order);
        $this->line('Void scope: order_and_appointment (required — settlement on file)');
        $this->line('Linked booking: '.json_encode($preview['linked_bookings'] ?? []));

        if (! $this->option('force')) {
            $this->warn('Dry-run only. Cash Sales will NOT change (QR Pay). Re-run with --force to void.');

            return self::SUCCESS;
        }

        $actor = $this->resolveActor();
        $this->line('Actor: '.($actor?->email ?? 'null').' (id='.($actor?->id ?? 'null').')');

        $snapshotBefore = $closedSnapshots->mapWithKeys(
            fn ($s) => [(int) $s->id => (string) $s->cash_sales_snapshot]
        )->all();

        $result = $voidService->voidOrder(
            $order,
            self::REMARK,
            $actor?->id,
            'order_and_appointment',
            null,
        );

        $fresh = $result['order']->fresh();
        $bookingStatus = DB::table('bookings')->where('id', 1388)->value('status');

        $cashAfter = null;
        if ($openShift) {
            // Clear request memo if any
            if (app()->bound('request')) {
                foreach (array_keys(request()->attributes->all()) as $key) {
                    if (is_string($key) && str_starts_with($key, 'pos_cash_shift_cash_sales.')) {
                        request()->attributes->remove($key);
                    }
                }
            }
            $cashAfter = $cashSalesService->compute(
                $openShift->opened_at,
                now(),
                (int) $order->store_location_id,
            );
        }

        $snapshotAfter = PosCashShift::query()
            ->whereIn('id', array_keys($snapshotBefore))
            ->pluck('cash_sales_snapshot', 'id')
            ->map(fn ($v) => (string) $v)
            ->all();

        $this->info('VOIDED order status='.$fresh->status);
        $this->info('Booking 1388 status='.(string) $bookingStatus);

        if ($cashBefore !== null && $cashAfter !== null) {
            $this->line(sprintf(
                'Live Cash Sales AFTER: RM %s (delta %s)',
                number_format($cashAfter, 2),
                number_format($cashAfter - $cashBefore, 2),
            ));
            if (abs($cashAfter - $cashBefore) > 0.001) {
                $this->error('Unexpected Cash Sales change — investigate.');

                return self::FAILURE;
            }
            $this->info('Cash Sales unchanged (expected for QR Pay).');
        }

        foreach ($snapshotBefore as $id => $before) {
            $after = $snapshotAfter[$id] ?? null;
            if ((string) $before !== (string) $after) {
                $this->error("Close shift #{$id} snapshot changed {$before} -> {$after}");

                return self::FAILURE;
            }
        }
        $this->info('Closed cash_sales_snapshot rows unchanged.');

        return self::SUCCESS;
    }

    private function resolveActor(): ?User
    {
        $email = trim((string) $this->option('actor-email'));
        if ($email !== '') {
            return User::query()->where('email', $email)->first();
        }

        return User::query()
            ->where('email', 'like', '%infra%')
            ->orWhere('name', 'like', '%infra_core%')
            ->orWhere('name', 'like', '%INFRA%')
            ->orderBy('id')
            ->first()
            ?? User::query()->orderBy('id')->first();
    }
}
