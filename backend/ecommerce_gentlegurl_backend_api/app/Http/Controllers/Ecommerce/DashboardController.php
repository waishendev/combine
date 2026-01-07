<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $service)
    {
    }

    public function overview(Request $request)
    {
        [$start, $end] = $this->resolveDateRange($request);

        return response()->json($this->service->getOverview($start, $end));
    }

    private function resolveDateRange(Request $request): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');

        if (!($hasDateFrom && $hasDateTo)) {
            $today = Carbon::today();
            $start = $today->copy()->startOfMonth();
            $end = $today->copy()->endOfMonth()->endOfDay();
        } else {
            $start = Carbon::parse($request->query('date_from'))->startOfDay();
            $end = Carbon::parse($request->query('date_to'))->endOfDay();
        }

        return [$start, $end];
    }
}
