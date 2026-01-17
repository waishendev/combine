<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SalesReportController extends Controller
{
    public function __construct(private SalesReportService $service)
    {
    }

    public function overview(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $data = $this->service->getOverview($start, $end);

        $this->attachMeta($request, $data, $defaultRangeApplied, $start, $end);

        return response()->json($data);
    }

    public function daily(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $groupBy = $request->query('group_by', 'day');
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $data = $this->service->getDailyDataTable($start, $end, $groupBy, $perPage, $page);

        $this->attachMeta($request, $data, $defaultRangeApplied, $start, $end, [
            'group_by' => $groupBy,
            'per_page' => $perPage,
            'page' => $page,
        ]);

        return response()->json($data);
    }

    public function byCategory(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $top = (int) $request->query('top', 5);
        $data = $this->service->getByCategory($start, $end, $perPage, $page, $top);

        $this->attachMeta($request, $data, $defaultRangeApplied, $start, $end, [
            'per_page' => $perPage,
            'page' => $page,
            'top' => $top,
        ]);

        return response()->json($data);
    }

    public function byProducts(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $top = (int) $request->query('top', 5);
        $groupBy = $request->query('group_by', 'variant');
        $data = $this->service->getByProducts($start, $end, $perPage, $page, $top, $groupBy);

        $this->attachMeta($request, $data, $defaultRangeApplied, $start, $end, [
            'per_page' => $perPage,
            'page' => $page,
            'top' => $top,
            'group_by' => $groupBy,
        ]);

        return response()->json($data);
    }

    public function byCustomers(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $top = (int) $request->query('top', 5);
        $data = $this->service->getByCustomers($start, $end, $perPage, $page, $top);

        $this->attachMeta($request, $data, $defaultRangeApplied, $start, $end, [
            'per_page' => $perPage,
            'page' => $page,
            'top' => $top,
        ]);

        return response()->json($data);
    }

    private function resolveDateRange(Request $request): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');
        $defaultRangeApplied = !($hasDateFrom && $hasDateTo);

        if ($defaultRangeApplied) {
            $today = Carbon::today();
            $start = $today->copy()->startOfMonth();
            $end = $today->copy()->endOfMonth()->endOfDay();
        } else {
            $start = Carbon::parse($request->query('date_from'))->startOfDay();
            $end = Carbon::parse($request->query('date_to'))->endOfDay();
        }

        return [$start, $end, $defaultRangeApplied];
    }

    private function attachMeta(
        Request $request,
        array &$data,
        bool $defaultRangeApplied,
        Carbon $start,
        Carbon $end,
        array $context = []
    ): void
    {
        $profitSupported = $this->service->profitSupported();
        $meta = [
            'default_range_applied' => $defaultRangeApplied,
            'valid_statuses' => SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT,
            'timestamp_field' => 'placed_at_or_created_at',
            'profit_supported' => $profitSupported,
            'costing' => [
                'missing_cost_products_count' => $profitSupported
                    ? $this->service->missingCostProductsCount($start, $end)
                    : null,
            ],
        ];

        if ($request->boolean('debug')) {
            $meta['debug'] = [
                'filters' => [
                    'payment_status' => 'paid',
                    'statuses' => SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT,
                    'timestamp_field' => 'placed_at_or_created_at',
                ],
                'context' => $context,
            ];
        }

        $data['meta'] = $meta;
    }
}
