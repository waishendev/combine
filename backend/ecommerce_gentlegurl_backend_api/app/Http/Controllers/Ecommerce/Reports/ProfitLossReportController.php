<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\ProfitLossReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ProfitLossReportController extends Controller
{
    public function __construct(private ProfitLossReportService $service)
    {
    }

    public function index(Request $request)
    {
        $year = max(2000, min(2100, (int) $request->query('year', Carbon::today()->year)));

        return response()->json($this->service->monthly($year));
    }
}
