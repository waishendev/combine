<?php

namespace App\Services\Reports;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use App\Services\Booking\BookingServiceBlocksResolver;
use App\Services\Ecommerce\VoidRefundService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Monthly services usage report: count each completed/voided service (not deposits),
 * with settlement+addon amounts net of real refunds.
 */
class MonthlyServicesReportService
{
    public function __construct(
        private BookingServiceBlocksResolver $blocksResolver,
    ) {
    }

    public function build(int $year, int $monthFrom, int $monthTo, int $page = 1, int $perPage = 15): array
    {
        if ($monthTo < $monthFrom) {
            [$monthFrom, $monthTo] = [$monthTo, $monthFrom];
        }

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        $start = Carbon::create($year, $monthFrom, 1)->startOfDay();
        $end = Carbon::create($year, $monthTo, 1)->endOfMonth()->endOfDay();

        $bookingsQuery = Booking::query()
            ->whereIn('status', ['COMPLETED', 'VOIDED'])
            ->whereBetween(DB::raw('COALESCE(completed_at, start_at)'), [$start, $end])
            ->select([
                'id',
                'status',
                'service_id',
                'addon_items_json',
                'settled_service_amount',
                'addon_price',
                'store_location_id',
            ]);

        ReportBranchScope::applyCurrent($bookingsQuery, 'store_location_id');

        /** @var \Illuminate\Support\Collection<int, Booking> $bookings */
        $bookings = $bookingsQuery->get();

        if ($bookings->isEmpty()) {
            return $this->emptyPayload($year, $monthFrom, $monthTo, $page, $perPage);
        }

        $bookingIds = $bookings->pluck('id')->map(fn ($id) => (int) $id)->all();
        $orderLinesByBooking = $this->loadOrderServiceLines($bookingIds);
        $refundsByBooking = $this->loadRefundsByBooking($bookingIds);

        /** @var array<int, array{times:int, amount:float, void_times:int, void_amount:float}> $agg */
        $agg = [];
        $totalRefundAmount = 0.0;

        foreach ($bookings as $booking) {
            $bookingId = (int) $booking->id;
            $isVoid = strtoupper((string) $booking->status) === 'VOIDED';
            $lines = $orderLinesByBooking->get($bookingId);
            if ($lines === null || $lines->isEmpty()) {
                $lines = collect($this->fallbackLinesFromBooking($booking));
            } else {
                $lines = $lines->map(fn ($row) => [
                    'booking_service_id' => (int) $row->booking_service_id,
                    'times' => max(1, (int) ($row->quantity ?? 1)),
                    'amount' => round(max(0, (float) ($row->net_amount ?? 0)), 2),
                ]);
            }

            $lines = $lines
                ->filter(fn (array $line) => (int) ($line['booking_service_id'] ?? 0) > 0)
                ->values();

            if ($lines->isEmpty()) {
                continue;
            }

            $refund = round(max(0, (float) ($refundsByBooking[$bookingId] ?? 0)), 2);
            $totalRefundAmount += $refund;

            $grossTotal = round($lines->sum(fn (array $line) => (float) $line['amount']), 2);

            foreach ($lines as $line) {
                $serviceId = (int) $line['booking_service_id'];
                $times = max(1, (int) $line['times']);
                $gross = round(max(0, (float) $line['amount']), 2);

                if (! isset($agg[$serviceId])) {
                    $agg[$serviceId] = [
                        'times' => 0,
                        'amount' => 0.0,
                        'void_times' => 0,
                        'void_amount' => 0.0,
                    ];
                }

                if ($isVoid) {
                    $agg[$serviceId]['void_times'] += $times;
                    $agg[$serviceId]['void_amount'] = round($agg[$serviceId]['void_amount'] + $gross, 2);
                    // Qty still counts as performed work.
                    $agg[$serviceId]['times'] += $times;
                } else {
                    $share = $grossTotal > 0.0001 ? ($gross / $grossTotal) : 0.0;
                    $refundShare = round($refund * $share, 2);
                    $net = round(max(0, $gross - $refundShare), 2);

                    $agg[$serviceId]['times'] += $times;
                    $agg[$serviceId]['amount'] = round($agg[$serviceId]['amount'] + $net, 2);
                }
            }
        }

        $serviceIds = array_keys($agg);
        $services = $serviceIds === []
            ? collect()
            : BookingService::query()
                ->whereIn('id', $serviceIds)
                ->get(['id', 'name', 'cn_name'])
                ->keyBy('id');

        $rows = collect($agg)
            ->map(function (array $stats, int $serviceId) use ($services) {
                $service = $services->get($serviceId);

                return [
                    'booking_service_id' => $serviceId,
                    'name' => (string) ($service?->name ?? ('Service #'.$serviceId)),
                    'cn_name' => $service?->cn_name,
                    'times' => (int) $stats['times'],
                    'amount' => round((float) $stats['amount'], 2),
                    'void_times' => (int) $stats['void_times'],
                    'void_amount' => round((float) $stats['void_amount'], 2),
                ];
            })
            ->filter(fn (array $row) => $row['times'] >= 1)
            ->sortByDesc('times')
            ->values()
            ->all();

        $totalServicesBooked = (int) array_sum(array_column($rows, 'times'));
        $totalVoidTimes = (int) array_sum(array_column($rows, 'void_times'));
        $totalAmountNonVoid = round((float) array_sum(array_column($rows, 'amount')), 2);
        $totalVoidAmount = round((float) array_sum(array_column($rows, 'void_amount')), 2);
        $totalRefundAmount = round($totalRefundAmount, 2);
        $netAmount = $totalAmountNonVoid; // refunds already allocated into per-service amounts

        $top = $rows[0] ?? null;
        $topCount = $top ? (int) $top['times'] : 0;
        $topTied = $topCount > 0
            ? array_values(array_filter($rows, fn (array $row) => (int) $row['times'] === $topCount))
            : [];

        $total = count($rows);
        $lastPage = max(1, (int) ceil($total / $perPage));
        if ($page > $lastPage) {
            $page = $lastPage;
        }
        $offset = ($page - 1) * $perPage;
        $pageRows = array_slice($rows, $offset, $perPage);

        return [
            'year' => $year,
            'month_from' => $monthFrom,
            'month_to' => $monthTo,
            'data' => array_values($pageRows),
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
            'summary' => [
                'total_services_booked' => $totalServicesBooked,
                'total_void_times' => $totalVoidTimes,
                'total_amount_non_void' => $totalAmountNonVoid,
                'total_void_amount' => $totalVoidAmount,
                'total_refund_amount' => $totalRefundAmount,
                'net_amount' => $netAmount,
                'void_plus_refund_amount' => round($totalVoidAmount + $totalRefundAmount, 2),
                'top_service' => count($topTied) === 1 ? ($topTied[0]['name'] ?? null) : null,
                'top_service_count' => $topCount,
                'top_service_is_tie' => count($topTied) > 1,
                'top_services' => array_map(fn (array $row) => [
                    'booking_service_id' => $row['booking_service_id'],
                    'name' => $row['name'],
                    'cn_name' => $row['cn_name'],
                    'times' => $row['times'],
                ], $topTied),
            ],
        ];
    }

    /**
     * @param  list<int>  $bookingIds
     * @return \Illuminate\Support\Collection<int, \Illuminate\Support\Collection<int, object>>
     */
    private function loadOrderServiceLines(array $bookingIds)
    {
        if ($bookingIds === []) {
            return collect();
        }

        $lineNet = 'COALESCE(oi.line_total_after_discount, oi.effective_line_total, oi.line_total - COALESCE(oi.discount_amount, 0))';

        return DB::table('order_items as oi')
            ->whereIn('oi.booking_id', $bookingIds)
            ->whereIn('oi.line_type', ['booking_settlement', 'booking_addon'])
            ->whereNotNull('oi.booking_service_id')
            ->select([
                'oi.booking_id',
                'oi.booking_service_id',
                'oi.quantity',
                DB::raw("{$lineNet} as net_amount"),
            ])
            ->get()
            ->groupBy(fn ($row) => (int) $row->booking_id);
    }

    /**
     * @param  list<int>  $bookingIds
     * @return array<int, float>
     */
    private function loadRefundsByBooking(array $bookingIds): array
    {
        if ($bookingIds === []) {
            return [];
        }

        return DB::table('booking_refunds')
            ->whereIn('booking_id', $bookingIds)
            ->where('status', 'completed')
            ->whereRaw("COALESCE(reason, '') <> ?", [VoidRefundService::REASON])
            ->selectRaw('booking_id, COALESCE(SUM(amount), 0) as amount')
            ->groupBy('booking_id')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->booking_id => (float) $row->amount])
            ->all();
    }

    /**
     * @return list<array{booking_service_id:int, times:int, amount:float}>
     */
    private function fallbackLinesFromBooking(Booking $booking): array
    {
        $lines = [];
        $blocks = $this->blocksResolver->blocks($booking);

        foreach ($blocks as $block) {
            $serviceId = (int) ($block['service_id'] ?? 0);
            if ($serviceId > 0) {
                $lines[] = [
                    'booking_service_id' => $serviceId,
                    'times' => 1,
                    'amount' => round(max(0, (float) ($block['amount'] ?? 0)), 2),
                ];
            }

            foreach (($block['add_ons'] ?? []) as $addon) {
                if (! is_array($addon)) {
                    continue;
                }
                $addonServiceId = (int) ($addon['service_id'] ?? $addon['linked_booking_service_id'] ?? 0);
                if ($addonServiceId <= 0) {
                    continue;
                }
                $qty = max(1, (int) ($addon['quantity'] ?? 1));
                $amount = array_key_exists('line_gross_amount', $addon) && $addon['line_gross_amount'] !== null
                    ? (float) $addon['line_gross_amount']
                    : ((float) ($addon['extra_price'] ?? 0) * $qty);

                $lines[] = [
                    'booking_service_id' => $addonServiceId,
                    'times' => $qty,
                    'amount' => round(max(0, $amount), 2),
                ];
            }
        }

        // Last resort: primary service only with settled snapshot.
        if ($lines === [] && (int) ($booking->service_id ?? 0) > 0) {
            $lines[] = [
                'booking_service_id' => (int) $booking->service_id,
                'times' => 1,
                'amount' => round(max(0, (float) ($booking->settled_service_amount ?? 0)), 2),
            ];
        }

        return $lines;
    }

    private function emptyPayload(int $year, int $monthFrom, int $monthTo, int $page = 1, int $perPage = 15): array
    {
        return [
            'year' => $year,
            'month_from' => $monthFrom,
            'month_to' => $monthTo,
            'data' => [],
            'current_page' => max(1, $page),
            'last_page' => 1,
            'per_page' => max(1, min(100, $perPage)),
            'total' => 0,
            'summary' => [
                'total_services_booked' => 0,
                'total_void_times' => 0,
                'total_amount_non_void' => 0.0,
                'total_void_amount' => 0.0,
                'total_refund_amount' => 0.0,
                'net_amount' => 0.0,
                'void_plus_refund_amount' => 0.0,
                'top_service' => null,
                'top_service_count' => 0,
                'top_service_is_tie' => false,
                'top_services' => [],
            ],
        ];
    }
}
