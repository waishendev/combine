<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\MonthlyServicesReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MonthlyServicesReportController extends Controller
{
    public function __construct(
        private MonthlyServicesReportService $service,
    ) {
    }

    public function index(Request $request)
    {
        $year = max(2000, min(2100, (int) $request->query('year', Carbon::today()->year)));

        $monthFrom = max(1, min(12, (int) ($request->query('month_from') ?: $request->query('month') ?: Carbon::today()->month)));
        $monthTo = max(1, min(12, (int) ($request->query('month_to') ?: $request->query('month') ?: $monthFrom)));
        if ($monthTo < $monthFrom) {
            [$monthFrom, $monthTo] = [$monthTo, $monthFrom];
        }

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));

        return response()->json($this->service->build($year, $monthFrom, $monthTo, $page, $perPage));
    }
}
