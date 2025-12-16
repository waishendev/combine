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
        [$start, $end] = $this->resolveDateRange($request, 0);
        $data = $this->service->getOverview($start, $end);

        return response()->json($data);
    }

    public function daily(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);
        $groupBy = $request->query('group_by', 'day');
        $data = $this->service->getDaily($start, $end, $groupBy);

        return response()->json($data);
    }

    public function byCategory(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);
        $limit = (int) $request->query('limit', 50);
        $data = $this->service->getByCategory($start, $end, $limit);

        return response()->json($data);
    }

    public function topProducts(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);
        $limit = (int) $request->query('limit', 20);
        $data = $this->service->getTopProducts($start, $end, $limit);

        return response()->json($data);
    }

    public function topCustomers(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);
        $limit = (int) $request->query('limit', 20);
        $data = $this->service->getTopCustomers($start, $end, $limit);

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

        return [$start, $end];
    }
}
