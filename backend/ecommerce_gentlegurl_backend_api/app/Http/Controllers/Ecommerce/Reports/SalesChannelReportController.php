<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesChannelReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SalesChannelReportController extends Controller
{
    public function __construct(private SalesChannelReportService $service)
    {
    }

    public function ecommerce(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $data = $this->service->ecommerce($start, $end, [
            'channel' => $request->query('channel'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
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
}
