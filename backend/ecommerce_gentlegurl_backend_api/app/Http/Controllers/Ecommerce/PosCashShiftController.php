<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PosCashShift;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PosCashShiftController extends Controller
{
    /** Order statuses excluded from shift cash sales (void/cancelled never count toward drawer). */
    private const EXCLUDED_ORDER_STATUSES = ['cancelled', 'draft', 'voided'];

    public function current(Request $request)
    {
        $shift = $this->globalOpenShiftQuery()->first();

        return $this->respond([
            'shift' => $shift ? $this->serializeShift($shift) : null,
        ]);
    }

    public function open(Request $request)
    {
        $validated = $request->validate([
            'opened_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'opening_amount' => ['required', 'numeric', 'min:0'],
            'refill_cash_packet_amount' => ['nullable', 'numeric', 'min:0'],
            'atm_amount' => ['nullable', 'numeric', 'min:0'],
            'refill_cash_packet_note' => ['nullable', 'string'],
            'atm_note' => ['nullable', 'string'],
        ]);

        $shift = DB::transaction(function () use ($request, $validated) {
            $existing = $this->globalOpenShiftQuery()->lockForUpdate()->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    'shift' => [__('A cash shift is already open. Close the current shift before opening a new one.')],
                ]);
            }

            return PosCashShift::query()->create([
                'opening_amount' => round((float) $validated['opening_amount'], 2),
                'refill_cash_packet_amount' => $this->money($validated['refill_cash_packet_amount'] ?? 0),
                'atm_amount' => $this->money($validated['atm_amount'] ?? 0),
                'refill_cash_packet_note' => $validated['refill_cash_packet_note'] ?? null,
                'atm_note' => $validated['atm_note'] ?? null,
                'opened_by' => $request->user()?->id,
                'opened_staff_id' => (int) $validated['opened_staff_id'],
                'opened_at' => now(),
                'status' => PosCashShift::STATUS_OPEN,
            ]);
        });

        return $this->respond([
            'shift' => $this->serializeShift($shift->fresh(['opener', 'closer', 'openedStaff', 'closedStaff'])),
        ], __('Cash shift is open.'));
    }

    public function close(Request $request)
    {
        $validated = $request->validate([
            'closed_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'closing_amount' => ['required', 'numeric', 'min:0'],
            'withdraw_amount' => ['nullable', 'numeric', 'min:0'],
            'refill_cash_amount' => ['nullable', 'numeric', 'min:0'],
            'withdraw_note' => ['nullable', 'string'],
            'refill_cash_note' => ['nullable', 'string'],
            'remark' => ['nullable', 'string'],
        ]);

        $shift = DB::transaction(function () use ($request, $validated) {
            $shift = $this->globalOpenShiftQuery()->lockForUpdate()->firstOrFail();
            $shift->closing_amount = $this->money($validated['closing_amount']);
            $shift->withdraw_amount = $this->money($validated['withdraw_amount'] ?? 0);
            $shift->refill_cash_amount = $this->money($validated['refill_cash_amount'] ?? 0);
            $shift->withdraw_note = $validated['withdraw_note'] ?? null;
            $shift->refill_cash_note = $validated['refill_cash_note'] ?? null;
            $shift->closed_by = $request->user()?->id;
            $shift->closed_staff_id = (int) $validated['closed_staff_id'];
            $shift->closed_at = now();
            $shift->status = PosCashShift::STATUS_CLOSED;
            $shift->remark = $validated['remark'] ?? null;
            $shift->save();

            return $shift;
        });

        return $this->respond([
            'shift' => $this->serializeShift($shift->fresh(['opener', 'closer', 'openedStaff', 'closedStaff'])),
        ], __('Cash shift closed.'));
    }

    public function report(Request $request)
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in([PosCashShift::STATUS_OPEN, PosCashShift::STATUS_CLOSED])],
            'user_id' => ['nullable', 'integer'],
            'staff_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = PosCashShift::query()
            ->with(['opener:id,name,email', 'closer:id,name,email', 'openedStaff:id,name,email,phone', 'closedStaff:id,name,email,phone'])
            ->when(! empty($validated['date_from']), fn (Builder $q) => $q->whereDate('opened_at', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn (Builder $q) => $q->whereDate('opened_at', '<=', $validated['date_to']))
            ->when(! empty($validated['status']), fn (Builder $q) => $q->where('status', $validated['status']))
            ->when(! empty($validated['user_id']), function (Builder $q) use ($validated) {
                $q->where(function (Builder $inner) use ($validated) {
                    $inner->where('opened_by', (int) $validated['user_id'])
                        ->orWhere('closed_by', (int) $validated['user_id']);
                });
            })
            ->when(! empty($validated['staff_id']), function (Builder $q) use ($validated) {
                $q->where(function (Builder $inner) use ($validated) {
                    $inner->where('opened_staff_id', (int) $validated['staff_id'])
                        ->orWhere('closed_staff_id', (int) $validated['staff_id']);
                });
            })
            ->orderByDesc('opened_at');

        $paginator = $query->paginate((int) ($validated['per_page'] ?? 20));
        $paginator->getCollection()->transform(fn (PosCashShift $shift) => $this->serializeShift($shift));

        return $this->respond($paginator);
    }

    private function globalOpenShiftQuery(): Builder
    {
        return PosCashShift::query()
            ->with(['opener:id,name,email', 'closer:id,name,email', 'openedStaff:id,name,email,phone', 'closedStaff:id,name,email,phone'])
            ->where('status', PosCashShift::STATUS_OPEN)
            ->latest('opened_at');
    }

    private function serializeShift(PosCashShift $shift): array
    {
        $cashSales = $this->cashSalesForShift($shift);
        $openingAmount = (float) $shift->opening_amount;
        $refillCashPacketAmount = (float) ($shift->refill_cash_packet_amount ?? 0);
        $atmAmount = (float) ($shift->atm_amount ?? 0);
        $withdrawAmount = (float) ($shift->withdraw_amount ?? 0);
        $refillCashAmount = (float) ($shift->refill_cash_amount ?? 0);
        $totalInitialCash = round($openingAmount + $refillCashPacketAmount - $refillCashAmount, 2);
        $totalWithdraw = round($withdrawAmount - $atmAmount, 2);
        $expectedCash = round($totalInitialCash + $cashSales - $totalWithdraw, 2);
        $closingAmount = $shift->closing_amount !== null ? (float) $shift->closing_amount : null;

        return [
            'id' => (int) $shift->id,
            'opening_amount' => round($openingAmount, 2),
            'refill_cash_packet_amount' => round($refillCashPacketAmount, 2),
            'refill_cash_packet_note' => $shift->refill_cash_packet_note,
            'atm_amount' => round($atmAmount, 2),
            'atm_note' => $shift->atm_note,
            'opened_by' => $shift->opened_by ? (int) $shift->opened_by : null,
            'opened_by_name' => $shift->opener?->name,
            'opened_staff_id' => $shift->opened_staff_id ? (int) $shift->opened_staff_id : null,
            'opened_staff_name' => $shift->openedStaff?->name,
            'opened_at' => optional($shift->opened_at)?->toDateTimeString(),
            'closing_amount' => $closingAmount !== null ? round($closingAmount, 2) : null,
            'withdraw_amount' => round($withdrawAmount, 2),
            'withdraw_note' => $shift->withdraw_note,
            'refill_cash_amount' => round($refillCashAmount, 2),
            'refill_cash_note' => $shift->refill_cash_note,
            'closed_by' => $shift->closed_by ? (int) $shift->closed_by : null,
            'closed_by_name' => $shift->closer?->name,
            'closed_staff_id' => $shift->closed_staff_id ? (int) $shift->closed_staff_id : null,
            'closed_staff_name' => $shift->closedStaff?->name,
            'closed_at' => optional($shift->closed_at)?->toDateTimeString(),
            'status' => (string) $shift->status,
            'remark' => $shift->remark,
            'cash_sales' => round($cashSales, 2),
            'total_initial_cash' => $totalInitialCash,
            'total_withdraw' => $totalWithdraw,
            'expected_cash' => $expectedCash,
            'difference' => $closingAmount !== null ? round($closingAmount - $expectedCash, 2) : null,
            'created_at' => optional($shift->created_at)?->toDateTimeString(),
            'updated_at' => optional($shift->updated_at)?->toDateTimeString(),
        ];
    }

    private function money(mixed $value): float
    {
        return round((float) $value, 2);
    }

    private function cashSalesForShift(PosCashShift $shift): float
    {
        $start = $shift->opened_at;
        $end = $shift->closed_at ?? now();

        $cashFromPayments = (float) DB::table('order_payments')
            ->join('orders', 'orders.id', '=', 'order_payments.order_id')
            ->whereRaw('LOWER(order_payments.payment_method) = ?', ['cash'])
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('orders.paid_at', [$start, $end])
                    ->orWhere(function ($nested) use ($start, $end) {
                        $nested->whereNull('orders.paid_at')
                            ->whereBetween('orders.created_at', [$start, $end]);
                    });
            })
            ->whereNotIn('orders.status', self::EXCLUDED_ORDER_STATUSES)
            ->where(function ($query) {
                $query->whereIn('orders.pickup_or_shipping', ['pos', 'in_store'])
                    ->orWhereNotNull('orders.created_by_user_id');
            })
            ->sum('order_payments.amount');

        $fallbackCash = (float) DB::table('orders')
            ->whereRaw('LOWER(payment_method) = ?', ['cash'])
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('paid_at', [$start, $end])
                    ->orWhere(function ($nested) use ($start, $end) {
                        $nested->whereNull('paid_at')
                            ->whereBetween('created_at', [$start, $end]);
                    });
            })
            ->whereNotIn('status', self::EXCLUDED_ORDER_STATUSES)
            ->where(function ($query) {
                $query->whereIn('pickup_or_shipping', ['pos', 'in_store'])
                    ->orWhereNotNull('created_by_user_id');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('order_payments')
                    ->whereColumn('order_payments.order_id', 'orders.id');
            })
            ->sum('grand_total');

        return round($cashFromPayments + $fallbackCash, 2);
    }
}
