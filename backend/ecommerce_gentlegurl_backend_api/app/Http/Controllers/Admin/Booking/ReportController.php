<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function staff(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $rows = Booking::query()
            ->selectRaw('staff_id, status, COUNT(*) as total')
            ->when($from, fn (Builder $q) => $q->where('start_at', '>=', $from))
            ->when($to, fn (Builder $q) => $q->where('start_at', '<=', $to))
            ->when($request->filled('staff_id'), fn ($q) => $q->where('staff_id', (int) $request->staff_id))
            ->groupBy('staff_id', 'status')
            ->get();

        return $this->respond($rows);
    }

    public function staffExport(Request $request)
    {
        $rows = $this->staff($request)->getData(true)['data'] ?? [];

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['staff_id', 'status', 'total']);
            foreach ($rows as $row) {
                fputcsv($out, [$row['staff_id'] ?? '', $row['status'] ?? '', $row['total'] ?? 0]);
            }
            fclose($out);
        }, 'booking_staff_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function summary(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);
        $groupBy = $request->query('group_by', 'day');
        $perPage = (int) $request->query('per_page', $request->query('limit', 15));
        $page = (int) $request->query('page', 1);

        // Base query for rows
        $baseQuery = Booking::query()
            ->selectRaw($this->periodExpression($groupBy) . ' as period')
            ->selectRaw('COUNT(*) as total_bookings')
            ->selectRaw("SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count")
            ->selectRaw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count")
            ->selectRaw("SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count")
            ->selectRaw("SUM(CASE WHEN status = 'LATE_CANCELLATION' THEN 1 ELSE 0 END) as late_cancellation_count")
            ->selectRaw("SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show_count")
            ->selectRaw("SUM(CASE WHEN status = 'NOTIFIED_CANCELLATION' THEN 1 ELSE 0 END) as notified_cancellation_count")
            ->selectRaw('SUM(CASE WHEN payment_status = \'PAID\' THEN deposit_amount ELSE 0 END) as deposit_collected')
            ->when($from, fn (Builder $q) => $q->where('start_at', '>=', $from))
            ->when($to, fn (Builder $q) => $q->where('start_at', '<=', $to))
            ->groupBy('period')
            ->orderBy('period');

        // Get paginated results
        $paginated = $baseQuery->paginate($perPage, ['*'], 'page', $page);
        $rows = $paginated->items();

        // Calculate grand totals (all data)
        $grandTotalsQuery = Booking::query()
            ->selectRaw('COUNT(*) as total_bookings')
            ->selectRaw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count")
            ->selectRaw("SUM(CASE WHEN status = 'NOTIFIED_CANCELLATION' THEN 1 ELSE 0 END) as notified_cancellation_count")
            ->selectRaw('SUM(CASE WHEN payment_status = \'PAID\' THEN deposit_amount ELSE 0 END) as deposit_collected')
            ->when($from, fn (Builder $q) => $q->where('start_at', '>=', $from))
            ->when($to, fn (Builder $q) => $q->where('start_at', '<=', $to));

        $grandTotals = $grandTotalsQuery->first();

        // Calculate page totals (current page only)
        $pageTotals = collect($rows)->reduce(function ($acc, $row) {
            $acc['total_bookings'] += (int) ($row->total_bookings ?? 0);
            $acc['completed_count'] += (int) ($row->completed_count ?? 0);
            $acc['notified_cancellation_count'] += (int) ($row->notified_cancellation_count ?? 0);
            $acc['deposit_collected'] += (float) ($row->deposit_collected ?? 0);
            return $acc;
        }, [
            'total_bookings' => 0,
            'completed_count' => 0,
            'notified_cancellation_count' => 0,
            'deposit_collected' => 0,
        ]);

        return response()->json([
            'rows' => $rows,
            'grand_totals' => [
                'total_bookings' => (int) ($grandTotals->total_bookings ?? 0),
                'completed_count' => (int) ($grandTotals->completed_count ?? 0),
                'notified_cancellation_count' => (int) ($grandTotals->notified_cancellation_count ?? 0),
                'deposit_collected' => (float) ($grandTotals->deposit_collected ?? 0),
            ],
            'totals_page' => $pageTotals,
            'pagination' => [
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }

    public function summaryExport(Request $request)
    {
        $rows = $this->summary($request)->getData(true)['data'] ?? [];

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['period', 'total_bookings', 'confirmed_count', 'completed_count', 'cancelled_count', 'late_cancellation_count', 'no_show_count', 'notified_cancellation_count', 'deposit_collected']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['period'] ?? '',
                    $row['total_bookings'] ?? 0,
                    $row['confirmed_count'] ?? 0,
                    $row['completed_count'] ?? 0,
                    $row['cancelled_count'] ?? 0,
                    $row['late_cancellation_count'] ?? 0,
                    $row['no_show_count'] ?? 0,
                    $row['notified_cancellation_count'] ?? 0,
                    $row['deposit_collected'] ?? 0,
                ]);
            }
            fclose($out);
        }, 'booking_summary_report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function resolveRange(Request $request): array
    {
        $from = $request->filled('from')
            ? Carbon::parse($request->query('from'))->startOfDay()
            : null;
        $to = $request->filled('to')
            ? Carbon::parse($request->query('to'))->endOfDay()
            : null;

        return [$from, $to];
    }

    private function periodExpression(string $groupBy): string
    {
        $driver = Booking::query()->getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            return match ($groupBy) {
                'month' => "to_char(start_at, 'YYYY-MM')",
                'week' => "to_char(start_at, 'IYYY-\"W\"IW')",
                default => "to_char(start_at, 'YYYY-MM-DD')",
            };
        }

        return match ($groupBy) {
            'month' => "DATE_FORMAT(start_at, '%Y-%m')",
            'week' => "DATE_FORMAT(start_at, '%x-W%v')",
            default => "DATE_FORMAT(start_at, '%Y-%m-%d')",
        };
    }
}
