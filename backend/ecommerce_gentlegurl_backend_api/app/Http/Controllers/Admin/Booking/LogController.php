<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Booking audit logs.
 * Enhancement: booking-logs-query-v1 — batched actor_name + indexed list/export.
 */
class LogController extends Controller
{
    public function index(Request $request)
    {
        $paginator = $this->filteredQuery($request)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        $this->attachActorNames($paginator->getCollection());

        return $this->respond($paginator);
    }

    public function export(Request $request)
    {
        $query = $this->filteredQuery($request)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['id', 'booking_id', 'actor_type', 'actor_id', 'action', 'meta', 'created_at']);

            foreach ($query->cursor() as $row) {
                fputcsv($out, [
                    $row->id,
                    $row->booking_id,
                    $row->actor_type,
                    $row->actor_id,
                    $row->action,
                    json_encode($row->meta ?? []),
                    $row->created_at,
                ]);
            }

            fclose($out);
        }, 'booking_logs.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filteredQuery(Request $request): Builder
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

        return $query;
    }

    /**
     * Same actor_name semantics as before (User lookup for STAFF/ADMIN; SYSTEM → "System"),
     * but one whereIn instead of N× User::find.
     */
    private function attachActorNames(Collection $logs): void
    {
        $userActorIds = $logs
            ->filter(static fn ($log) => $log->actor_id
                && in_array($log->actor_type, ['STAFF', 'ADMIN'], true))
            ->pluck('actor_id')
            ->map(static fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $namesById = $userActorIds === []
            ? collect()
            : User::query()->whereIn('id', $userActorIds)->pluck('name', 'id');

        foreach ($logs as $log) {
            $actorName = null;
            if ($log->actor_id && $log->actor_type) {
                if ($log->actor_type === 'STAFF' || $log->actor_type === 'ADMIN') {
                    $actorName = $namesById[(int) $log->actor_id] ?? null;
                } elseif ($log->actor_type === 'SYSTEM') {
                    $actorName = 'System';
                }
            }
            $log->actor_name = $actorName;
        }
    }
}
