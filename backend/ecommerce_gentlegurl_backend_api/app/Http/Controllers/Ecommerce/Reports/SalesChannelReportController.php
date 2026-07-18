<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesChannelReportService;
use App\Services\Reports\SalesVisualDailyReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SalesChannelReportController extends Controller
{
    public function __construct(
        private SalesChannelReportService $service,
        private SalesVisualDailyReportService $visualDaily,
    ) {
    }

    public function salesSummary(Request $request)
    {
        $year = max(2000, min(2100, (int) $request->query('year', Carbon::today()->year)));

        $yearFrom = $request->filled('year_from')
            ? max(2000, min(2100, (int) $request->query('year_from')))
            : $year;
        $yearTo = $request->filled('year_to')
            ? max(2000, min(2100, (int) $request->query('year_to')))
            : $yearFrom;
        if ($yearTo < $yearFrom) {
            [$yearFrom, $yearTo] = [$yearTo, $yearFrom];
        }

        // Multi-year yearly summary (one row per year).
        if (! $request->filled('month') && ! $request->filled('month_from') && $yearFrom !== $yearTo) {
            return response()->json($this->visualDaily->yearlySalesSummary($yearFrom, $yearTo));
        }

        $monthFrom = null;
        $monthTo = null;
        if ($request->filled('month_from') || $request->filled('month_to') || $request->filled('month')) {
            $monthFrom = max(1, min(12, (int) ($request->query('month_from') ?: $request->query('month') ?: 1)));
            $monthTo = max(1, min(12, (int) ($request->query('month_to') ?: $request->query('month') ?: $monthFrom)));
            if ($monthTo < $monthFrom) {
                [$monthFrom, $monthTo] = [$monthTo, $monthFrom];
            }
        }

        // Month range within a year → daily rows across those months.
        if ($monthFrom !== null) {
            return response()->json($this->visualDaily->dailySalesSummaryRange($year, $monthFrom, $monthTo));
        }

        // Single-year monthly summary (Jan–Dec rows).
        return response()->json($this->visualDaily->salesSummary($yearFrom, null));
    }

    public function visualDailyEcommerce(Request $request)
    {
        [$start, $end] = $this->resolveVisualDateRange($request);

        if ($start->toDateString() === $end->toDateString()) {
            return response()->json($this->visualDaily->ecommerceDay($start));
        }

        return response()->json($this->visualDaily->ecommercePeriod($start, $end));
    }

    public function visualDailyBooking(Request $request)
    {
        [$start, $end] = $this->resolveVisualDateRange($request);

        if ($start->toDateString() === $end->toDateString()) {
            return response()->json($this->visualDaily->bookingDay($start));
        }

        return response()->json($this->visualDaily->bookingPeriod($start, $end));
    }

    public function visualDailyAll(Request $request)
    {
        [$start, $end] = $this->resolveVisualDateRange($request);

        if ($start->toDateString() === $end->toDateString()) {
            return response()->json($this->visualDaily->allDay($start));
        }

        $payload = $this->visualDaily->allPeriod($start, $end);
        $payload['date_from'] = $start->toDateString();
        $payload['date_to'] = $end->toDateString();

        return response()->json($payload);
    }

    public function visualPeriodAll(Request $request)
    {
        $year = max(2000, min(2100, (int) $request->query('year', Carbon::today()->year)));

        $yearFrom = $request->filled('year_from')
            ? max(2000, min(2100, (int) $request->query('year_from')))
            : $year;
        $yearTo = $request->filled('year_to')
            ? max(2000, min(2100, (int) $request->query('year_to')))
            : $yearFrom;
        if ($yearTo < $yearFrom) {
            [$yearFrom, $yearTo] = [$yearTo, $yearFrom];
        }

        $monthFrom = null;
        $monthTo = null;
        if ($request->filled('month_from') || $request->filled('month_to') || $request->filled('month')) {
            $monthFrom = max(1, min(12, (int) ($request->query('month_from') ?: $request->query('month') ?: 1)));
            $monthTo = max(1, min(12, (int) ($request->query('month_to') ?: $request->query('month') ?: $monthFrom)));
            if ($monthTo < $monthFrom) {
                [$monthFrom, $monthTo] = [$monthTo, $monthFrom];
            }
        }

        if ($monthFrom !== null) {
            $start = Carbon::create($year, $monthFrom, 1)->startOfDay();
            $end = Carbon::create($year, $monthTo, 1)->endOfMonth()->endOfDay();
            $label = $monthFrom === $monthTo
                ? $start->format('F Y')
                : $start->format('M') . ' – ' . $end->format('M Y');
            $mode = 'monthly';
            $month = $monthFrom;
        } elseif ($yearFrom !== $yearTo) {
            $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
            $end = Carbon::create($yearTo, 12, 31)->endOfDay();
            $label = $yearFrom . ' – ' . $yearTo;
            $mode = 'yearly';
            $month = null;
            $year = $yearFrom;
        } else {
            $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
            $end = $start->copy()->endOfYear()->endOfDay();
            $label = (string) $yearFrom;
            $mode = 'yearly';
            $month = null;
            $year = $yearFrom;
        }

        $payload = $this->visualDaily->allPeriod($start, $end);
        $payload['period'] = [
            'year' => $year,
            'year_from' => $yearFrom,
            'year_to' => $yearTo,
            'month' => $month,
            'month_from' => $monthFrom,
            'month_to' => $monthTo,
            'mode' => $mode,
            'label' => $label,
        ];

        return response()->json($payload);
    }

    public function details(int $orderId)
    {
        return response()->json($this->service->orderDetails($orderId));
    }

    public function ecommerce(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $data = $this->service->ecommerce($start, $end, [
            'channel' => $request->query('channel'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'customer_id' => $request->query('customer_id'),
            'per_page' => (int) $request->query('per_page', $request->query('limit', 15)),
            'page' => (int) $request->query('page', 1),
        ]);

        return response()->json($data);
    }

    public function booking(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $data = $this->service->booking($start, $end, [
            'channel' => $request->query('channel'),
            'payment_method' => $request->query('payment_method'),
            'type' => $request->query('type'),
            'customer_id' => $request->query('customer_id'),
            'per_page' => (int) $request->query('per_page', $request->query('limit', 15)),
            'page' => (int) $request->query('page', 1),
        ]);

        return response()->json($data);
    }

    public function exportEcommerce(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $rows = $this->service->ecommerceRows($start, $end, [
            'channel' => $request->query('channel'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'customer_id' => $request->query('customer_id'),
        ]);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Item Count', 'Product Amount', 'Discount', 'Net Amount', 'Status']);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['order_no'] ?? '',
                    $row['date_time'] ?? '',
                    $row['customer'] ?? '',
                    $row['channel'] ?? '',
                    $row['payment_method'] ?? '',
                    $row['item_count'] ?? 0,
                    $row['product_amount'] ?? 0,
                    $row['discount'] ?? 0,
                    $row['net_amount'] ?? 0,
                    $row['status'] ?? '',
                ]);
            }

            fclose($out);
        }, 'ecommerce_sales_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportBooking(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $rows = $this->service->bookingRows($start, $end, [
            'channel' => $request->query('channel'),
            'payment_method' => $request->query('payment_method'),
            'type' => $request->query('type'),
            'customer_id' => $request->query('customer_id'),
        ]);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Type', 'Booking No', 'Package Name', 'Gross Amount', 'Discount', 'Net Amount', 'Status']);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['order_no'] ?? '',
                    $row['date_time'] ?? '',
                    $row['customer'] ?? '',
                    $row['channel'] ?? '',
                    $row['payment_method'] ?? '',
                    $row['type'] ?? '',
                    $row['booking_no'] ?? '',
                    $row['package_name'] ?? '',
                    $row['gross_amount'] ?? 0,
                    $row['discount'] ?? 0,
                    $row['net_amount'] ?? 0,
                    $row['status'] ?? '',
                ]);
            }

            fclose($out);
        }, 'booking_sales_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function resolveDateRange(Request $request): array
    {
        if (! $request->filled('date_from') || ! $request->filled('date_to')) {
            $today = Carbon::today();
            return [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()->endOfDay()];
        }

        return [
            Carbon::parse((string) $request->query('date_from'))->startOfDay(),
            Carbon::parse((string) $request->query('date_to'))->endOfDay(),
        ];
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function resolveVisualDateRange(Request $request): array
    {
        if ($request->filled('date_from') || $request->filled('date_to')) {
            $from = Carbon::parse((string) ($request->query('date_from') ?: $request->query('date_to') ?: $request->query('date', Carbon::today()->toDateString())))->startOfDay();
            $to = Carbon::parse((string) ($request->query('date_to') ?: $request->query('date_from') ?: $from->toDateString()))->endOfDay();
            if ($to->lt($from)) {
                [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
            }

            return [$from, $to];
        }

        $day = $request->filled('date')
            ? Carbon::parse((string) $request->query('date'))->startOfDay()
            : Carbon::today();

        return [$day->copy()->startOfDay(), $day->copy()->endOfDay()];
    }
}
