<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardService;
use App\Services\Reports\ReportBranchScope;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $service)
    {
    }

    public function overview(Request $request, StoreLocationAccessService $access)
    {
        $scope = ReportBranchScope::fromRequest($request, $access);
        [$start, $end, $defaultRangeApplied] = $this->service->resolveCurrentRange($request);
        [$previousStart, $previousEnd] = $this->service->resolvePreviousRange($start, $end, $defaultRangeApplied);

        return response()->json($this->service->getOverview($start, $end, $previousStart, $previousEnd, $scope));
    }
}
