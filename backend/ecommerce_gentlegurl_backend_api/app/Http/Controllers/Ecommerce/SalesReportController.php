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
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request, 0);
        $data = $this->service->getOverview($start, $end);

        $this->attachMeta($request, $data, $defaultRangeApplied);

        return response()->json($data);
    }

    public function daily(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $groupBy = $request->query('group_by', 'day');
        $data = $this->service->getDaily($start, $end, $groupBy);

        $this->attachMeta($request, $data, $defaultRangeApplied, [
            'group_by' => $groupBy,
        ]);

        return response()->json($data);
    }

    public function byCategory(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $data = $this->service->getByCategory($start, $end, $perPage, $page);

        $this->attachMeta($request, $data, $defaultRangeApplied, [
            'per_page' => $perPage,
            'page' => $page,
        ]);

        return response()->json($data);
    }

    public function topProducts(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $data = $this->service->getTopProducts($start, $end, $perPage, $page);

        $this->attachMeta($request, $data, $defaultRangeApplied, [
            'per_page' => $perPage,
            'page' => $page,
        ]);

        return response()->json($data);
    }

    public function topCustomers(Request $request)
    {
        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);
        $data = $this->service->getTopCustomers($start, $end, $perPage, $page);

        $this->attachMeta($request, $data, $defaultRangeApplied, [
            'per_page' => $perPage,
            'page' => $page,
        ]);

        return response()->json($data);
    }

    private function resolveDateRange(Request $request, int $defaultDays = 30): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');

        $endDate = $hasDateTo ? Carbon::parse($request->query('date_to')) : Carbon::today();
        $end = $endDate->copy()->endOfDay();

        if ($hasDateFrom) {
            $start = Carbon::parse($request->query('date_from'))->startOfDay();
        } elseif ($defaultDays === 0) {
            $start = Carbon::today()->startOfDay();
        } else {
            $start = $endDate->copy()->subDays($defaultDays - 1)->startOfDay();
        }

        return [$start, $end, !($hasDateFrom && $hasDateTo)];
    }

    private function attachMeta(Request $request, array &$data, bool $defaultRangeApplied, array $context = []): void
    {
        $meta = [
            'default_range_applied' => $defaultRangeApplied,
            'valid_statuses' => SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT,
            'timestamp_field' => 'placed_at_or_created_at',
            'profit_supported' => $this->service->profitSupported(),
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
