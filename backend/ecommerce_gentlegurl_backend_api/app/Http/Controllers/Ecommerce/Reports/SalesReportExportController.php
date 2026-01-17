<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesReportExportService;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SalesReportExportController extends Controller
{
    public function __construct(
        private SalesReportService $service,
        private SalesReportExportService $exportService
    )
    {
    }

    public function overview(Request $request): StreamedResponse
    {
        $this->ensureCsvFormat($request);
        [$start, $end, $displayStart, $displayEnd] = $this->resolveDateRange($request, 'overview');
        $data = $this->service->getOverview($start, $end);

        $headers = [
            'from',
            'to',
            'orders_count',
            'items_count',
            'revenue',
            'cogs',
            'gross_profit',
            'average_order_value',
        ];

        $statusHeaders = ['status', 'orders_count', 'revenue'];

        return $this->streamCsv(
            $this->buildFilename('sales_overview', $displayStart, $displayEnd),
            function ($output) use ($headers, $statusHeaders, $data, $displayStart, $displayEnd) {
                $this->exportService->writeCsvHeader($output, $headers);
                $this->exportService->writeCsvRow($output, [
                    $displayStart->toDateString(),
                    $displayEnd->toDateString(),
                    $data['totals']['orders_count'] ?? 0,
                    $data['totals']['items_count'] ?? 0,
                    $data['totals']['revenue'] ?? 0,
                    $data['totals']['cogs'] ?? null,
                    $data['totals']['gross_profit'] ?? null,
                    $data['totals']['average_order_value'] ?? 0,
                ]);
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvHeader($output, $statusHeaders);
                foreach ($data['by_status'] ?? [] as $row) {
                    $this->exportService->writeCsvRow($output, [
                        $row['status'] ?? '',
                        $row['orders_count'] ?? 0,
                        $row['revenue'] ?? 0,
                    ]);
                }
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvTotalsRow($output, $statusHeaders, [
                    'orders_count' => $data['totals']['orders_count'] ?? 0,
                    'revenue' => $data['totals']['revenue'] ?? 0,
                ]);
            }
        );
    }

    public function daily(Request $request): StreamedResponse
    {
        $this->ensureCsvFormat($request);
        [$start, $end, $displayStart, $displayEnd] = $this->resolveDateRange($request, 'daily');
        $data = $this->service->getDaily($start, $end);

        $headers = [
            'date',
            'orders_count',
            'items_count',
            'revenue',
            'cogs',
            'gross_profit',
        ];

        $totals = $data['totals'] ?? [];
        $totalsRow = [
            'orders_count' => $totals['orders_count'] ?? $this->sumFromRows($data['rows'] ?? [], 'orders_count'),
            'items_count' => $totals['items_count'] ?? $this->sumFromRows($data['rows'] ?? [], 'items_count'),
            'revenue' => $totals['revenue'] ?? $this->sumFromRows($data['rows'] ?? [], 'revenue'),
            'cogs' => $totals['cogs'] ?? $this->sumFromRows($data['rows'] ?? [], 'cogs'),
            'gross_profit' => $totals['gross_profit'] ?? $this->sumFromRows($data['rows'] ?? [], 'gross_profit'),
        ];

        return $this->streamCsv(
            $this->buildFilename('sales_daily', $displayStart, $displayEnd),
            function ($output) use ($headers, $data, $totalsRow) {
                $this->exportService->writeCsvHeader($output, $headers);
                foreach ($data['rows'] ?? [] as $row) {
                    $this->exportService->writeCsvRow($output, [
                        $row['date'] ?? '',
                        $row['orders_count'] ?? 0,
                        $row['items_count'] ?? 0,
                        $row['revenue'] ?? 0,
                        $row['cogs'] ?? null,
                        $row['gross_profit'] ?? null,
                    ]);
                }
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvTotalsRow($output, $headers, $totalsRow);
            }
        );
    }

    public function byCategory(Request $request): StreamedResponse
    {
        $this->ensureCsvFormat($request);
        [$start, $end, $displayStart, $displayEnd] = $this->resolveDateRange($request, 'by-category');
        $rows = $this->service->getByCategoryRows($start, $end);

        $headers = [
            'category_id',
            'category_name',
            'orders_count',
            'items_count',
            'revenue',
            'cogs',
            'gross_profit',
        ];

        return $this->streamCsv(
            $this->buildFilename('sales_by_category', $displayStart, $displayEnd),
            function ($output) use ($headers, $rows) {
                $this->exportService->writeCsvHeader($output, $headers);
                $totals = [
                    'orders_count' => 0,
                    'items_count' => 0,
                    'revenue' => 0,
                    'cogs' => 0,
                    'gross_profit' => 0,
                ];
                foreach ($rows as $row) {
                    $this->exportService->writeCsvRow($output, [
                        $row['category_id'] ?? null,
                        $row['category_name'] ?? '',
                        $row['orders_count'] ?? 0,
                        $row['items_count'] ?? 0,
                        $row['revenue'] ?? 0,
                        $row['cogs'] ?? null,
                        $row['gross_profit'] ?? null,
                    ]);
                    $totals['orders_count'] += $row['orders_count'] ?? 0;
                    $totals['items_count'] += $row['items_count'] ?? 0;
                    $totals['revenue'] += $row['revenue'] ?? 0;
                    $totals['cogs'] += $row['cogs'] ?? 0;
                    $totals['gross_profit'] += $row['gross_profit'] ?? 0;
                }
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvTotalsRow($output, $headers, $totals);
            }
        );
    }

    public function byProducts(Request $request): StreamedResponse
    {
        $this->ensureCsvFormat($request);
        [$start, $end, $displayStart, $displayEnd] = $this->resolveDateRange($request, 'by-products');
        $groupBy = $request->query('group_by', 'variant');
        $rows = $this->service->getByProductsRows($start, $end, $groupBy);

        $headers = [
            'product_id',
            'product_name',
            'sku',
            'orders_count',
            'items_count',
            'revenue',
            'cogs',
            'gross_profit',
        ];

        return $this->streamCsv(
            $this->buildFilename('sales_by_products', $displayStart, $displayEnd),
            function ($output) use ($headers, $rows) {
                $this->exportService->writeCsvHeader($output, $headers);
                $totals = [
                    'orders_count' => 0,
                    'items_count' => 0,
                    'revenue' => 0,
                    'cogs' => 0,
                    'gross_profit' => 0,
                ];
                foreach ($rows as $row) {
                    $this->exportService->writeCsvRow($output, [
                        $row['product_id'] ?? null,
                        $row['product_name'] ?? '',
                        $row['sku'] ?? '',
                        $row['orders_count'] ?? 0,
                        $row['items_count'] ?? 0,
                        $row['revenue'] ?? 0,
                        $row['cogs'] ?? null,
                        $row['gross_profit'] ?? null,
                    ]);
                    $totals['orders_count'] += $row['orders_count'] ?? 0;
                    $totals['items_count'] += $row['items_count'] ?? 0;
                    $totals['revenue'] += $row['revenue'] ?? 0;
                    $totals['cogs'] += $row['cogs'] ?? 0;
                    $totals['gross_profit'] += $row['gross_profit'] ?? 0;
                }
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvTotalsRow($output, $headers, $totals);
            }
        );
    }

    public function byCustomers(Request $request): StreamedResponse
    {
        $this->ensureCsvFormat($request);
        [$start, $end, $displayStart, $displayEnd] = $this->resolveDateRange($request, 'by-customers');
        $rows = $this->service->getByCustomersRows($start, $end);

        $headers = [
            'customer_id',
            'customer_name',
            'customer_email',
            'orders_count',
            'items_count',
            'revenue',
            'average_order_value',
            'cogs',
            'gross_profit',
        ];

        return $this->streamCsv(
            $this->buildFilename('sales_by_customers', $displayStart, $displayEnd),
            function ($output) use ($headers, $rows) {
                $this->exportService->writeCsvHeader($output, $headers);
                $totals = [
                    'orders_count' => 0,
                    'items_count' => 0,
                    'revenue' => 0,
                    'average_order_value' => 0,
                    'cogs' => 0,
                    'gross_profit' => 0,
                ];
                foreach ($rows as $row) {
                    $this->exportService->writeCsvRow($output, [
                        $row['customer_id'] ?? null,
                        $row['customer_name'] ?? '',
                        $row['customer_email'] ?? '',
                        $row['orders_count'] ?? 0,
                        $row['items_count'] ?? 0,
                        $row['revenue'] ?? 0,
                        $row['average_order_value'] ?? 0,
                        $row['cogs'] ?? null,
                        $row['gross_profit'] ?? null,
                    ]);
                    $totals['orders_count'] += $row['orders_count'] ?? 0;
                    $totals['items_count'] += $row['items_count'] ?? 0;
                    $totals['revenue'] += $row['revenue'] ?? 0;
                    $totals['cogs'] += $row['cogs'] ?? 0;
                    $totals['gross_profit'] += $row['gross_profit'] ?? 0;
                }
                $totals['average_order_value'] =
                    $totals['orders_count'] > 0 ? $totals['revenue'] / $totals['orders_count'] : 0;
                $this->exportService->writeCsvRow($output, []);
                $this->exportService->writeCsvTotalsRow($output, $headers, $totals);
            }
        );
    }

    private function ensureCsvFormat(Request $request): void
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        if ($format !== 'csv') {
            abort(422, 'Only csv format is supported.');
        }
    }

    private function resolveDateRange(Request $request, string $report): array
    {
        $timezone = $request->query('timezone', config('app.timezone'));
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');

        if ($hasDateFrom && $hasDateTo) {
            $start = Carbon::parse($request->query('date_from'), $timezone)->startOfDay();
            $end = Carbon::parse($request->query('date_to'), $timezone)->endOfDay();
        } else {
            $today = Carbon::now($timezone);
            if ($report === 'overview') {
                $start = $today->copy()->startOfDay();
                $end = $today->copy()->endOfDay();
            } else {
                $start = $today->copy()->subDays(29)->startOfDay();
                $end = $today->copy()->endOfDay();
            }
        }

        $queryTimezone = config('app.timezone');
        $queryStart = $start->copy()->setTimezone($queryTimezone);
        $queryEnd = $end->copy()->setTimezone($queryTimezone);

        return [$queryStart, $queryEnd, $start, $end];
    }

    private function streamCsv(string $filename, callable $writer): StreamedResponse
    {
        return response()->streamDownload(function () use ($writer) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            $writer($output);
            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function buildFilename(string $report, Carbon $start, Carbon $end): string
    {
        return sprintf(
            '%s_%s_to_%s.csv',
            $report,
            $start->toDateString(),
            $end->toDateString()
        );
    }

    private function sumFromRows(array $rows, string $key): float
    {
        $sum = 0.0;
        foreach ($rows as $row) {
            $sum += $row[$key] ?? 0;
        }

        return $sum;
    }
}
