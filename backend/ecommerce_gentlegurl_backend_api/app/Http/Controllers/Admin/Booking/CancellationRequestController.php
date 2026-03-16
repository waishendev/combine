<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingCancellationRequest;
use App\Models\Booking\BookingLog;
use App\Services\Booking\CustomerServicePackageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CancellationRequestController extends Controller
{
    public function __construct(private readonly CustomerServicePackageService $customerServicePackageService)
    {
    }

    public function index(Request $request)
    {
        $query = BookingCancellationRequest::query()
            ->with([
                'booking:id,booking_code,status,start_at,service_id,staff_id,customer_id',
                'booking.customer:id,name',
                'booking.service:id,name',
                'booking.staff:id,name',
                'reviewer:id,name',
            ])
            ->orderByDesc('requested_at');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('booking_id')) {
            $query->where('booking_id', (int) $request->integer('booking_id'));
        }

        return $this->respond($query->paginate($request->integer('per_page', 20)));
    }

    public function show(int $id)
    {
        $record = BookingCancellationRequest::query()
            ->with([
                'booking:id,booking_code,status,start_at,service_id,staff_id,customer_id',
                'booking.customer:id,name,phone',
                'booking.service:id,name',
                'booking.staff:id,name',
                'reviewer:id,name',
            ])
            ->findOrFail($id);

        return $this->respond($record);
    }

    public function approve(Request $request, int $id)
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $adminId = optional($request->user())->id;

        $record = BookingCancellationRequest::query()->with('booking')->findOrFail($id);

        if ($record->status !== 'pending') {
            return $this->respondError('Only pending requests can be approved.', 422);
        }

        if (! $record->booking) {
            return $this->respondError('Booking not found for this request.', 404);
        }

        if ($record->booking->status !== 'CONFIRMED') {
            return $this->respondError('Only confirmed bookings can be cancelled from a request.', 422);
        }

        DB::transaction(function () use ($record, $validated, $adminId) {
            $booking = $record->booking;

            $record->update([
                'status' => 'approved',
                'admin_note' => $validated['admin_note'] ?? null,
                'reviewed_at' => now(),
                'reviewed_by_admin_id' => $adminId,
            ]);

            $booking->status = 'CANCELLED';
            $booking->cancelled_at = now();
            $booking->cancellation_type = 'CANCELLED';
            $booking->save();

            $this->customerServicePackageService->releaseReservedClaimsForBooking((int) $booking->id);

            BookingLog::create([
                'booking_id' => $booking->id,
                'actor_type' => 'ADMIN',
                'actor_id' => $adminId,
                'action' => 'APPROVE_CANCELLATION_REQUEST',
                'meta' => [
                    'request_id' => (int) $record->id,
                    'admin_note' => $validated['admin_note'] ?? null,
                ],
                'created_at' => now(),
            ]);
        });

        return $this->respond($record->fresh(['booking', 'booking.customer', 'booking.service', 'booking.staff', 'reviewer']));
    }

    public function reject(Request $request, int $id)
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $adminId = optional($request->user())->id;

        $record = BookingCancellationRequest::query()->with('booking')->findOrFail($id);

        if ($record->status !== 'pending') {
            return $this->respondError('Only pending requests can be rejected.', 422);
        }

        $record->update([
            'status' => 'rejected',
            'admin_note' => $validated['admin_note'] ?? null,
            'reviewed_at' => now(),
            'reviewed_by_admin_id' => $adminId,
        ]);

        BookingLog::create([
            'booking_id' => $record->booking_id,
            'actor_type' => 'ADMIN',
            'actor_id' => $adminId,
            'action' => 'REJECT_CANCELLATION_REQUEST',
            'meta' => [
                'request_id' => (int) $record->id,
                'admin_note' => $validated['admin_note'] ?? null,
            ],
            'created_at' => now(),
        ]);

        return $this->respond($record->fresh(['booking', 'booking.customer', 'booking.service', 'booking.staff', 'reviewer']));
    }
}
