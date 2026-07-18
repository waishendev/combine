<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PosCashShift;
use App\Services\Ecommerce\PosCashPoolService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PosCashShiftController extends Controller
{
    /** Order statuses excluded from shift cash sales (void/cancelled never count toward drawer). */
    private const EXCLUDED_ORDER_STATUSES = ['cancelled', 'draft', 'voided'];

    public function __construct(private readonly PosCashPoolService $cashPoolService) {}

    public function current(Request $request)
    {
        $shift = $this->globalOpenShiftQuery()->first();

        return $this->respond([
            'shift' => $shift ? $this->serializeShift($shift) : null,
            'pool_balances' => $this->cashPoolService->balances(),
        ]);
    }

    public function open(Request $request)
    {
        $validated = $request->validate([
            'opened_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'opening_amount' => ['required', 'numeric', 'min:0'],
            'opening_refill_packet' => ['nullable', 'numeric', 'min:0'],
            'opening_atm' => ['nullable', 'numeric', 'min:0'],
        ]);

        $openingAmount = round((float) $validated['opening_amount'], 2);
        $refillPacket = round((float) ($validated['opening_refill_packet'] ?? 0), 2);
        $atm = round((float) ($validated['opening_atm'] ?? 0), 2);

        $shift = DB::transaction(function () use ($request, $validated, $openingAmount, $refillPacket, $atm) {
            $existing = $this->globalOpenShiftQuery()->lockForUpdate()->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    'shift' => [__('A cash shift is already open. Close the current shift before opening a new one.')],
                ]);
            }

            $shift = PosCashShift::query()->create([
                'event_type' => PosCashShift::EVENT_OPEN,
                'opening_amount' => $openingAmount,
                'opening_refill_packet' => $refillPacket > 0 ? $refillPacket : null,
                'opening_atm' => $atm > 0 ? $atm : null,
                'opened_by' => $request->user()?->id,
                'opened_staff_id' => (int) $validated['opened_staff_id'],
                'opened_at' => now(),
                'status' => PosCashShift::STATUS_OPEN,
            ]);

            $pools = $this->cashPoolService->applyOpenMovements(
                $shift,
                $refillPacket,
                $atm,
                $request->user()?->id,
            );

            $shift->update([
                'total_initial_cash' => $pools['total_initial_cash'],
                'total_withdraw' => $pools['total_withdraw'],
            ]);

            return $shift;
        });

        return $this->respond([
            'shift' => $this->serializeShift($shift->fresh(['opener', 'closer', 'openedStaff', 'closedStaff', 'linkedOpenShift'])),
            'pool_balances' => $this->cashPoolService->balances(),
        ], __('Cash shift is open.'));
    }

    public function close(Request $request)
    {
        $validated = $request->validate([
            'closed_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'closing_amount' => ['required', 'numeric', 'min:0'],
            'closing_withdraw' => ['nullable', 'numeric', 'min:0'],
            'closing_refill_cash' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string'],
        ]);

        $shift = DB::transaction(function () use ($request, $validated) {
            $openShift = $this->globalOpenShiftQuery()->lockForUpdate()->firstOrFail();
            PosCashShift::query()->whereKey($openShift->id)->lockForUpdate()->first();

            $closingAmount = round((float) $validated['closing_amount'], 2);
            $withdraw = round((float) ($validated['closing_withdraw'] ?? 0), 2);
            $refillCash = round((float) ($validated['closing_refill_cash'] ?? 0), 2);

            $closeShift = PosCashShift::query()->create([
                'event_type' => PosCashShift::EVENT_CLOSE,
                'linked_open_shift_id' => $openShift->id,
                'opening_amount' => $openShift->opening_amount,
                'opening_refill_packet' => $openShift->opening_refill_packet,
                'opening_atm' => $openShift->opening_atm,
                'opened_by' => $openShift->opened_by,
                'opened_staff_id' => $openShift->opened_staff_id,
                'opened_at' => $openShift->opened_at,
                'closing_amount' => $closingAmount,
                'closing_withdraw' => $withdraw > 0 ? $withdraw : null,
                'closing_refill_cash' => $refillCash > 0 ? $refillCash : null,
                'closed_by' => $request->user()?->id,
                'closed_staff_id' => (int) $validated['closed_staff_id'],
                'closed_at' => now(),
                'status' => PosCashShift::STATUS_CLOSED,
                'remark' => $validated['remark'] ?? null,
            ]);

            $pools = $this->cashPoolService->applyCloseMovements(
                $closeShift,
                $withdraw,
                $refillCash,
                $request->user()?->id,
            );

            $closeShift->update([
                'total_initial_cash' => $pools['total_initial_cash'],
                'total_withdraw' => $pools['total_withdraw'],
            ]);

            return $closeShift;
        });

        return $this->respond([
            'shift' => $this->serializeShift($shift->fresh(['opener', 'closer', 'openedStaff', 'closedStaff', 'linkedOpenShift.openedStaff', 'linkedOpenShift.opener'])),
            'pool_balances' => $this->cashPoolService->balances(),
        ], __('Cash shift closed.'));
    }

    public function summary(Request $request)
    {
        $openShift = $this->globalOpenShiftQuery()->first();

        return $this->respond([
            'pool_balances' => $this->cashPoolService->balances(),
            'open_shift' => $openShift ? $this->serializeShift($openShift) : null,
        ]);
    }

    public function report(Request $request)
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in([PosCashShift::EVENT_OPEN, PosCashShift::EVENT_CLOSE])],
            'user_id' => ['nullable', 'integer'],
            'staff_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = PosCashShift::query()
            ->with([
                'opener:id,name,email',
                'closer:id,name,email',
                'openedStaff:id,name,email,phone',
                'closedStaff:id,name,email,phone',
                'linkedOpenShift.openedStaff:id,name,email,phone',
                'linkedOpenShift.opener:id,name,email',
            ])
            ->when(! empty($validated['date_from']), function (Builder $q) use ($validated) {
                $q->where(function (Builder $inner) use ($validated) {
                    $inner->whereDate('opened_at', '>=', $validated['date_from'])
                        ->orWhereDate('closed_at', '>=', $validated['date_from']);
                });
            })
            ->when(! empty($validated['date_to']), function (Builder $q) use ($validated) {
                $q->where(function (Builder $inner) use ($validated) {
                    $inner->whereDate('opened_at', '<=', $validated['date_to'])
                        ->orWhereDate('closed_at', '<=', $validated['date_to']);
                });
            })
            ->when(! empty($validated['status']), fn (Builder $q) => $q->where('event_type', $validated['status']))
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
            ->orderByDesc(DB::raw('COALESCE(closed_at, opened_at)'));

        $periodSummary = $this->buildPeriodSummary(clone $query);

        $paginator = $query->paginate((int) ($validated['per_page'] ?? 20));
        $paginator->getCollection()->transform(fn (PosCashShift $shift) => $this->serializeShift($shift));

        return $this->respond([
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
            'period_summary' => $periodSummary,
            'filters' => [
                'date_from' => $validated['date_from'] ?? null,
                'date_to' => $validated['date_to'] ?? null,
            ],
        ]);
    }

    /**
     * Sum Cash Sales / Difference for CLOSE events in the current report filter.
     *
     * @return array{cash_sales: float, difference: float}
     */
    private function buildPeriodSummary(Builder $query): array
    {
        $closeShifts = $query
            ->where('event_type', PosCashShift::EVENT_CLOSE)
            ->with([
                'linkedOpenShift.openedStaff:id,name,email,phone',
                'linkedOpenShift.opener:id,name,email',
            ])
            ->get();

        $cashSales = 0.0;
        $difference = 0.0;

        foreach ($closeShifts as $shift) {
            $row = $this->serializeShift($shift);
            $cashSales += (float) ($row['cash_sales'] ?? 0);
            if ($row['difference'] !== null) {
                $difference += (float) $row['difference'];
            }
        }

        return [
            'cash_sales' => round($cashSales, 2),
            'difference' => round($difference, 2),
        ];
    }

    private function globalOpenShiftQuery(): Builder
    {
        return PosCashShift::query()
            ->with(['opener:id,name,email', 'closer:id,name,email', 'openedStaff:id,name,email,phone', 'closedStaff:id,name,email,phone'])
            ->where('event_type', PosCashShift::EVENT_OPEN)
            ->whereDoesntHave('closeEvent')
            ->latest('opened_at');
    }

    private function serializeShift(PosCashShift $shift): array
    {
        $openShift = $shift->isCloseEvent() ? $shift->linkedOpenShift : $shift;
        $openingAmount = (float) ($openShift?->opening_amount ?? $shift->opening_amount ?? 0);
        $cashSales = $this->cashSalesForShift($shift, $openShift);
        $expectedCash = $shift->isCloseEvent()
            ? round($openingAmount + $cashSales, 2)
            : round($openingAmount + $cashSales, 2);
        $closingAmount = $shift->closing_amount !== null ? (float) $shift->closing_amount : null;
        $eventAt = $shift->isCloseEvent()
            ? optional($shift->closed_at)?->toDateTimeString()
            : optional($shift->opened_at)?->toDateTimeString();

        return [
            'id' => (int) $shift->id,
            'event_type' => (string) ($shift->event_type ?? PosCashShift::EVENT_OPEN),
            'linked_open_shift_id' => $shift->linked_open_shift_id ? (int) $shift->linked_open_shift_id : null,
            'event_at' => $eventAt,
            'opening_amount' => round($openingAmount, 2),
            'opening_refill_packet' => $shift->opening_refill_packet !== null
                ? round((float) $shift->opening_refill_packet, 2)
                : ($openShift?->opening_refill_packet !== null ? round((float) $openShift->opening_refill_packet, 2) : null),
            'opening_atm' => $shift->opening_atm !== null
                ? round((float) $shift->opening_atm, 2)
                : ($openShift?->opening_atm !== null ? round((float) $openShift->opening_atm, 2) : null),
            'opened_by' => ($openShift?->opened_by ?? $shift->opened_by) ? (int) ($openShift?->opened_by ?? $shift->opened_by) : null,
            'opened_by_name' => $openShift?->opener?->name ?? $shift->opener?->name,
            'opened_staff_id' => ($openShift?->opened_staff_id ?? $shift->opened_staff_id) ? (int) ($openShift?->opened_staff_id ?? $shift->opened_staff_id) : null,
            'opened_staff_name' => $openShift?->openedStaff?->name ?? $shift->openedStaff?->name,
            'opened_at' => optional($openShift?->opened_at ?? $shift->opened_at)?->toDateTimeString(),
            'closing_amount' => $closingAmount !== null ? round($closingAmount, 2) : null,
            'closing_withdraw' => $shift->closing_withdraw !== null ? round((float) $shift->closing_withdraw, 2) : null,
            'closing_refill_cash' => $shift->closing_refill_cash !== null ? round((float) $shift->closing_refill_cash, 2) : null,
            'closed_by' => $shift->closed_by ? (int) $shift->closed_by : null,
            'closed_by_name' => $shift->closer?->name,
            'closed_staff_id' => $shift->closed_staff_id ? (int) $shift->closed_staff_id : null,
            'closed_staff_name' => $shift->closedStaff?->name,
            'closed_at' => optional($shift->closed_at)?->toDateTimeString(),
            'status' => (string) $shift->event_type,
            'remark' => $shift->remark,
            'total_initial_cash' => round((float) ($shift->total_initial_cash ?? 0), 2),
            'total_withdraw' => round((float) ($shift->total_withdraw ?? 0), 2),
            'cash_sales' => round($cashSales, 2),
            'expected_cash' => $expectedCash,
            'difference' => $shift->isCloseEvent() && $closingAmount !== null
                ? round($closingAmount - $expectedCash, 2)
                : null,
            'created_at' => optional($shift->created_at)?->toDateTimeString(),
            'updated_at' => optional($shift->updated_at)?->toDateTimeString(),
        ];
    }

    private function cashSalesForShift(PosCashShift $shift, ?PosCashShift $openShift = null): float
    {
        $openShift ??= $shift->isCloseEvent() ? $shift->linkedOpenShift : $shift;
        if (! $openShift?->opened_at) {
            return 0.0;
        }

        $start = $openShift->opened_at;
        $end = $shift->isCloseEvent() ? ($shift->closed_at ?? now()) : now();

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
