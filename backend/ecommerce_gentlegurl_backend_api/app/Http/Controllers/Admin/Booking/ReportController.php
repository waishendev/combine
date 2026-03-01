<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function staff(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $rows = Booking::query()
            ->selectRaw('staff_id, status, COUNT(*) as total')
            ->whereBetween('start_at', [$from, $to])
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

        $format = match ($groupBy) {
            'month' => '%Y-%m',
            'week' => '%x-W%v',
            default => '%Y-%m-%d',
        };

        $rows = Booking::query()
            ->selectRaw("DATE_FORMAT(start_at, '{$format}') as period")
            ->selectRaw('COUNT(*) as total_bookings')
            ->selectRaw("SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count")
            ->selectRaw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count")
            ->selectRaw("SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count")
            ->selectRaw("SUM(CASE WHEN status = 'LATE_CANCELLATION' THEN 1 ELSE 0 END) as late_cancellation_count")
            ->selectRaw("SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show_count")
            ->selectRaw("SUM(CASE WHEN status = 'NOTIFIED_CANCELLATION' THEN 1 ELSE 0 END) as notified_cancellation_count")
            ->selectRaw('SUM(CASE WHEN payment_status = \'PAID\' THEN deposit_amount ELSE 0 END) as deposit_collected')
            ->whereBetween('start_at', [$from, $to])
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        return $this->respond($rows);
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
        $from = Carbon::parse($request->query('from', now()->subDays(30)->toDateString()))->startOfDay();
        $to = Carbon::parse($request->query('to', now()->toDateString()))->endOfDay();

        return [$from, $to];
    }
}
