<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\ProfitLossReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use App\Services\Reports\ReportBranchScope;
use App\Services\StoreLocationAccessService;

class ProfitLossReportController extends Controller
{
    public function __construct(private ProfitLossReportService $service)
    {
    }

    public function index(Request $request)
    {
        $year = max(2000, min(2100, (int) $request->query('year', Carbon::today()->year)));

        $scope = ReportBranchScope::current();
        $includeGlobalExpenses = $scope->selectedStoreLocationId === null
            && app(StoreLocationAccessService::class)->hasPlatformBypass($request->user());

        return response()->json(array_merge($this->service->monthly($year, $includeGlobalExpenses), [
            'accounting_scope' => [
                'complete_company_view' => $includeGlobalExpenses,
                'global_expenses_included' => $includeGlobalExpenses,
                'result_label' => $includeGlobalExpenses ? 'Profit & Loss' : 'Branch contribution',
            ],
        ]));
    }
}
