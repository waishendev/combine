<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\AppointmentActivityLogService;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 1), 200);
        $supportedActions = ['created', 'updated', 'deleted'];

        $query = ActivityLog::query()
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

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

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

        return $this->respond([
            'rows' => $rows,
            'pagination' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
            'filters' => [
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
            ],
        ]);
    }
    public function appointmentIndex(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $actions = array_keys(AppointmentActivityLogService::ACTIONS);

        $query = ActivityLog::query()
            ->where('model_type', 'Booking')
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
                  ->orWhere('new_values->>booking_number', 'ilike', "%{$search}%")
                  ->orWhere('new_values->>customer_name', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $logs = $query->paginate($perPage);

        return $this->respond([
            'rows' => $logs->getCollection()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'appointment_id' => $log->model_id,
                'booking_number' => $log->new_values['booking_number'] ?? $log->model_label,
                'customer_name' => $log->new_values['customer_name'] ?? null,
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
            'filters' => [
                'actions' => collect(AppointmentActivityLogService::ACTIONS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
                'users' => ActivityLog::query()->where('model_type', 'Booking')->whereIn('action', $actions)->whereNotNull('user_id')->selectRaw('DISTINCT user_id, user_name')->orderBy('user_name')->get()->map(fn ($row) => ['id' => $row->user_id, 'name' => $row->user_name]),
            ],
        ]);
    }

}
