<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosSummaryReportController extends MyPosSummaryReportController
{
    public function index(Request $request): JsonResponse
    {
        return $this->buildReport($request, false);
    }
}
