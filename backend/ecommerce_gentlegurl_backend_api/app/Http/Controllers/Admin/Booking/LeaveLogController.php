<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeaveLogController extends Controller
{
    public function index(Request $request)
    {
        $query = BookingLeaveLog::query()
            ->with([
                'staff:id,name',
                'creator:id,name',
            ]);

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->input('staff_id'));
        }

        if ($request->filled('action_type')) {
            $query->where('action_type', (string) $request->input('action_type'));
        }

        if ($request->filled('from_date')) {
            $query->where('created_at', '>=', Carbon::parse((string) $request->input('from_date'))->startOfDay());
        }

        if ($request->filled('to_date')) {
            $query->where('created_at', '<=', Carbon::parse((string) $request->input('to_date'))->endOfDay());
        }

        $rows = $query
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return $this->respond($rows);
    }
}
