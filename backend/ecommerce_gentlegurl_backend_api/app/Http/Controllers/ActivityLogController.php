<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\AppointmentActivityLogService;
use App\Support\PosAppointmentStartAtFilter;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /** @var list<string> */
    private const LIST_COLUMNS = [
        'id',
        'user_id',
        'user_name',
        'action',
        'model_type',
        'model_id',
        'model_label',
        'old_values',
        'new_values',
        'ip_address',
        'created_at',
    ];

    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 1), 200);
        $page = max(1, (int) $request->integer('page', 1));
        $supportedActions = ['created', 'updated', 'deleted'];

        $query = ActivityLog::query()
            ->select(self::LIST_COLUMNS)
            ->whereIn('action', $supportedActions)
            ->latest('created_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('action') && in_array((string) $request->input('action'), $supportedActions, true)) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('model_type')) {
            $query->where('model_type', $request->input('model_type'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('model_label', 'ilike', "%{$search}%")
                    ->orWhere('user_name', 'ilike', "%{$search}%");
            });
        }

        $this->applyCreatedAtDayRange($query, $request);

        $logs = $query->paginate($perPage);

        $rows = $logs->getCollection()->map(function (ActivityLog $log) {
            return [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name,
                'action' => $log->action,
                'model_type' => $log->model_type,
                'model_id' => $log->model_id,
                'model_label' => $log->model_label,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
            ];
        })->values();

        $payload = [
            'rows' => $rows,
            'pagination' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ];

        // Facets are stable across pages; recompute on page 1 or when explicitly requested.
        // FE keeps previous filters.model_types / filters.users when the key is omitted.
        if ($this->shouldIncludeActivityLogFilters($request, $page)) {
            $payload['filters'] = [
                'model_types' => ActivityLog::query()
                    ->whereIn('action', $supportedActions)
                    ->distinct()
                    ->orderBy('model_type')
                    ->pluck('model_type'),
                'users' => ActivityLog::query()
                    ->whereIn('action', $supportedActions)
                    ->whereNotNull('user_id')
                    ->selectRaw('DISTINCT user_id, user_name')
                    ->orderBy('user_name')
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->user_id,
                        'name' => $row->user_name,
                    ]),
            ];
        }

        return $this->respond($payload);
    }

    public function show(int $id)
    {
        $log = ActivityLog::query()
            ->select(array_merge(self::LIST_COLUMNS, ['user_agent']))
            ->whereIn('action', ['created', 'updated', 'deleted'])
            ->findOrFail($id);

        return $this->respond([
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user_name,
            'action' => $log->action,
            'model_type' => $log->model_type,
            'model_id' => $log->model_id,
            'model_label' => $log->model_label,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
        ]);
    }

    public function appointmentIndex(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $page = max(1, (int) $request->integer('page', 1));
        $actions = array_keys(AppointmentActivityLogService::ACTIONS);

        // Appointment CRM list only needs identity + action + actor (not full jsonb payloads).
        $listColumns = [
            'id',
            'user_id',
            'user_name',
            'action',
            'model_type',
            'model_id',
            'model_label',
            'new_values',
            'created_at',
        ];

        $scope = \App\Services\Reports\ReportBranchScope::current();
        $query = ActivityLog::query()
            ->select($listColumns)
            ->where('model_type', 'Booking')
            ->whereExists(fn ($bookings) => $scope->apply($bookings->selectRaw('1')->from('bookings')
                ->whereColumn('bookings.id', 'activity_logs.model_id'), 'bookings.store_location_id'))
            ->whereIn('action', $actions)
            ->latest('created_at');

        if ($request->filled('action') && in_array((string) $request->input('action'), $actions, true)) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('actor_user_id')) {
            $query->where('user_id', (int) $request->input('actor_user_id'));
        }

        if ($request->filled('booking_number')) {
            $booking = trim((string) $request->input('booking_number'));
            $query->where(function ($q) use ($booking) {
                $q->where('model_label', 'ilike', "%{$booking}%")
                    ->orWhere('new_values->>booking_number', 'ilike', "%{$booking}%");
            });
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('model_label', 'ilike', "%{$search}%")
                    ->orWhere('user_name', 'ilike', "%{$search}%")
                    ->orWhere('new_values->>booking_number', 'ilike', "%{$search}%");
            });
        }

        $this->applyCreatedAtDayRange($query, $request);

        $logs = $query->paginate($perPage);

        $payload = [
            'rows' => $logs->getCollection()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'appointment_id' => $log->model_id,
                'booking_number' => $log->new_values['booking_number'] ?? $log->model_label,
                'action' => $log->action,
                'action_label' => AppointmentActivityLogService::ACTIONS[$log->action] ?? $log->action,
                'actor_user_id' => $log->user_id,
                'actor_name' => $log->user_name,
                'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
            ])->values(),
            'pagination' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
            // actions are static (no SQL); users DISTINCT is skipped on page > 1 unless include_filters=1.
            'filters' => [
                'actions' => collect(AppointmentActivityLogService::ACTIONS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            ],
        ];

        if ($this->shouldIncludeActivityLogFilters($request, $page)) {
            $payload['filters']['users'] = ActivityLog::query()->where('model_type', 'Booking')
                ->whereExists(fn ($bookings) => $scope->apply($bookings->selectRaw('1')->from('bookings')
                    ->whereColumn('bookings.id', 'activity_logs.model_id'), 'bookings.store_location_id'))
                ->whereIn('action', $actions)->whereNotNull('user_id')
                ->selectRaw('DISTINCT user_id, user_name')->orderBy('user_name')->get()
                ->map(fn ($row) => ['id' => $row->user_id, 'name' => $row->user_name]);
        }

        return $this->respond($payload);
    }

    /**
     * Same calendar-day semantics as whereDate(), using half-open sargable bounds.
     */
    private function applyCreatedAtDayRange(Builder $query, Request $request): void
    {
        $from = $request->filled('date_from') ? (string) $request->input('date_from') : null;
        $to = $request->filled('date_to') ? (string) $request->input('date_to') : null;

        if ($from !== null && $from !== '' && $to !== null && $to !== '') {
            PosAppointmentStartAtFilter::apply($query, $from, $to, null, null, 'created_at');

            return;
        }

        $timezone = (string) config('app.timezone');

        if ($from !== null && $from !== '') {
            $query->where(
                'created_at',
                '>=',
                Carbon::parse($from, $timezone)->startOfDay()->format('Y-m-d H:i:s')
            );
        }

        if ($to !== null && $to !== '') {
            $query->where(
                'created_at',
                '<',
                Carbon::parse($to, $timezone)->startOfDay()->addDay()->format('Y-m-d H:i:s')
            );
        }
    }

    private function shouldIncludeActivityLogFilters(Request $request, int $page): bool
    {
        if ($request->boolean('include_filters')) {
            return true;
        }

        // Explicit opt-out for clients that already cached facets.
        if ($request->exists('include_filters') && ! $request->boolean('include_filters')) {
            return false;
        }

        return $page <= 1;
    }
}
