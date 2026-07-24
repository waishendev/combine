<?php

namespace App\Services\Reports;

use App\Models\Expense;
use Carbon\Carbon;

class ProfitLossReportService
{
    public function __construct(private SalesVisualDailyReportService $salesSummary)
    {
    }

    /**
     * Builds the monthly P&L from the same sales-summary payload used by Yearly Sales Report.
     */
    public function monthly(int $year): array
    {
        $sales = $this->salesSummary->salesSummary($year);
        $costingByMonth = $this->salesSummary->ecommerceCostingByMonth($year);
        $expenseByMonth = $this->expensesByMonth($year);
        $months = [];

        foreach ($sales['rows'] as $salesRow) {
            $month = (int) $salesRow['month'];
            $ecommerceSales = round((float) $salesRow['ecommerce_sales'], 2);
            $bookingSales = round((float) $salesRow['booking_sales'], 2);
            $refund = round((float) $salesRow['refund'], 2);
            $ecommerceCosting = round((float) ($costingByMonth[$month] ?? 0), 2);
            $expense = round((float) ($expenseByMonth[$month] ?? 0), 2);

            $months[] = [
                'month' => $month,
                'month_name' => $salesRow['month_name'],
                'ecommerce_sales' => $ecommerceSales,
                'ecommerce_costing' => $ecommerceCosting,
                'booking_sales' => $bookingSales,
                'refund' => $refund,
                'expense' => $expense,
                'profit_loss' => round($ecommerceSales + $bookingSales - $ecommerceCosting - $refund - $expense, 2),
            ];
        }

        $totals = collect($months)->reduce(function (array $totals, array $row) {
            foreach (array_keys($totals) as $key) {
                $totals[$key] += $row[$key];
            }

            return $totals;
        }, [
            'ecommerce_sales' => 0.0,
            'ecommerce_costing' => 0.0,
            'booking_sales' => 0.0,
            'refund' => 0.0,
            'expense' => 0.0,
            'profit_loss' => 0.0,
        ]);

        return [
            'year' => $year,
            'months' => $months,
            'totals' => array_map(fn (float $amount) => round($amount, 2), $totals),
            'meta' => [
                'sales_source' => 'sales-summary',
                'costing' => 'order_items.cost_amount_snapshot_only',
                'expense_date_field' => 'expense_date',
            ],
        ];
    }

    /** @return array<int, float> */
    private function expensesByMonth(int $year): array
    {
        return Expense::query()
            ->whereBetween('expense_date', [Carbon::create($year, 1, 1)->toDateString(), Carbon::create($year, 12, 31)->toDateString()])
            ->selectRaw('EXTRACT(MONTH FROM expense_date)::int as month, COALESCE(SUM(amount), 0) as expense')
            ->groupByRaw('EXTRACT(MONTH FROM expense_date)::int')
            ->pluck('expense', 'month')
            ->map(fn ($amount) => (float) $amount)
            ->all();
    }
}
