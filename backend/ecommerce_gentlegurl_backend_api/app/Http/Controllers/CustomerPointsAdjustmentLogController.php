<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\CustomerPointsAdjustmentLog;
use Illuminate\Http\Request;

class CustomerPointsAdjustmentLogController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $logs = CustomerPointsAdjustmentLog::query()
            ->with([
                'customer:id,name,phone',
                'createdBy:id,name,username',
            ])
            ->latest('created_at')
            ->paginate($perPage);

        $rows = $logs->getCollection()->map(function (CustomerPointsAdjustmentLog $log) {
            return [
                'id' => $log->id,
                'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
                'action_type' => $log->action_type,
                'points' => $log->points,
                'before_balance' => $log->before_balance,
                'after_balance' => $log->after_balance,
                'remark' => $log->remark,
                'customer' => [
                    'id' => $log->customer?->id,
                    'name' => $log->customer?->name,
                    'phone' => $log->customer?->phone,
                ],
                'created_by' => [
                    'id' => $log->createdBy?->id,
                    'name' => $log->createdBy?->name ?? $log->createdBy?->username,
                ],
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
        ]);
    }
}
