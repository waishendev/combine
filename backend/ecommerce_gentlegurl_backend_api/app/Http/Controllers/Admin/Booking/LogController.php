<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function index(Request $request)
    {
        $query = BookingLog::query();
        if ($request->filled('from')) {
            $query->where('created_at', '>=', Carbon::parse($request->query('from'))->startOfDay());
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', Carbon::parse($request->query('to'))->endOfDay());
        }
        foreach (['actor_type', 'actor_id', 'action', 'booking_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        return $this->respond($query->orderByDesc('created_at')->paginate($request->integer('per_page', 50)));
    }

    public function export(Request $request)
    {
        $rows = $this->index($request)->getData(true)['data']['data'] ?? [];

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['id', 'booking_id', 'actor_type', 'actor_id', 'action', 'meta', 'created_at']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['id'] ?? null,
                    $row['booking_id'] ?? null,
                    $row['actor_type'] ?? null,
                    $row['actor_id'] ?? null,
                    $row['action'] ?? null,
                    json_encode($row['meta'] ?? []),
                    $row['created_at'] ?? null,
                ]);
            }
            fclose($out);
        }, 'booking_logs.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
