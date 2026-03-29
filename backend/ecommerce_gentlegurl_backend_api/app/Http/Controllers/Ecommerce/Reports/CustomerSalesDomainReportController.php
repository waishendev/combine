<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\CustomerSalesDomainReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CustomerSalesDomainReportController extends Controller
{
    public function __construct(private CustomerSalesDomainReportService $service)
    {
    }

    public function ecommerce(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        return response()->json($this->service->ecommerce($start, $end, [
            'customer' => $request->query('customer'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'channel' => $request->query('channel'),
            'per_page' => (int) $request->query('per_page', $request->query('limit', 15)),
            'page' => (int) $request->query('page', 1),
            'top' => (int) $request->query('top', 5),
        ]));
    }

    public function booking(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        return response()->json($this->service->booking($start, $end, [
            'customer' => $request->query('customer'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'channel' => $request->query('channel'),
            'per_page' => (int) $request->query('per_page', $request->query('limit', 15)),
            'page' => (int) $request->query('page', 1),
            'top' => (int) $request->query('top', 5),
        ]));
    }

    public function exportEcommerce(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $rows = $this->service->ecommerceRows($start, $end, [
            'customer' => $request->query('customer'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'channel' => $request->query('channel'),
        ]);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Customer', 'Email', 'Orders', 'Items', 'Revenue', 'COGS', 'Gross Profit', 'Last Purchase Date']);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['customer_name'] ?? '',
                    $row['customer_email'] ?? '',
                    $row['orders_count'] ?? 0,
                    $row['items_count'] ?? 0,
                    $row['revenue'] ?? 0,
                    $row['cogs'] ?? 0,
                    $row['gross_profit'] ?? 0,
                    $row['last_purchase_date'] ?? '',
                ]);
            }

            fclose($out);
        }, 'customers_ecommerce_sales_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportBooking(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        $rows = $this->service->bookingRows($start, $end, [
            'customer' => $request->query('customer'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            'channel' => $request->query('channel'),
        ]);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Customer', 'Email', 'Transactions', 'Booking Deposit Amount', 'Booking Settlement Amount', 'Package Purchase Amount', 'Total Revenue', 'Last Transaction Date']);

            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['customer_name'] ?? '',
                    $row['customer_email'] ?? '',
                    $row['transactions_count'] ?? 0,
                    $row['booking_deposit_amount'] ?? 0,
                    $row['booking_settlement_amount'] ?? 0,
                    $row['package_purchase_amount'] ?? 0,
                    $row['total_revenue'] ?? 0,
                    $row['last_transaction_date'] ?? '',
                ]);
            }

            fclose($out);
        }, 'customers_booking_sales_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
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
