<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesVisualDailyReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyStaffSalesReportController extends Controller
{
    public function __construct(
        private SalesVisualDailyReportService $visualDaily,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $staffId = $user?->staff_id;

        if (! $staffId) {
            return response()->json([
                'message' => 'This account is not linked to a staff profile.',
            ], 403);
        }

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'date' => ['nullable', 'date'],
        ]);

        if (! empty($validated['date_from']) && ! empty($validated['date_to'])) {
            $start = Carbon::parse((string) $validated['date_from'])->startOfDay();
            $end = Carbon::parse((string) $validated['date_to'])->endOfDay();
        } elseif (! empty($validated['date'])) {
            $day = Carbon::parse((string) $validated['date'])->startOfDay();
            $start = $day->copy();
            $end = $day->copy()->endOfDay();
        } else {
            $today = Carbon::today();
            $start = $today->copy()->startOfDay();
            $end = $today->copy()->endOfDay();
        }

        return response()->json(
            $this->visualDaily->staffSalesSummary($start, $end, (int) $staffId)
        );
    }
}
