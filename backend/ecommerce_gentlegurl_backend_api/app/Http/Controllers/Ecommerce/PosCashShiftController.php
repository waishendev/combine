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
use App\Services\StoreLocationAccessService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\PosCashPoolAccount;

class PosCashShiftController extends Controller
{
    /** Order statuses excluded from shift cash sales (void/cancelled never count toward drawer). */
    private const EXCLUDED_ORDER_STATUSES = ['cancelled', 'draft', 'voided'];

    public function __construct(private readonly PosCashPoolService $cashPoolService, private readonly StoreLocationAccessService $branchAccess) {}

    public function current(Request $request)
    {
        $branch = $this->operationalBranch($request);
        $shift = $this->openShiftQuery($branch->id)->first();

        return $this->respond([
            'shift' => $shift ? $this->serializeShift($shift) : null,
            'pool_balances' => $this->cashPoolService->balances($branch->id),
        ]);
    }

    public function open(Request $request)
    {
        $validated = $request->validate([
            'store_location_id' => ['nullable', 'integer'],
            'opened_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'opening_amount' => ['required', 'numeric', 'min:0'],
            'opening_refill_packet' => ['nullable', 'numeric', 'min:0'],
            'opening_atm' => ['nullable', 'numeric', 'min:0'],
        ]);
        $branch = $this->operationalBranch($request);

        $openingAmount = round((float) $validated['opening_amount'], 2);
        $refillPacket = round((float) ($validated['opening_refill_packet'] ?? 0), 2);
        $atm = round((float) ($validated['opening_atm'] ?? 0), 2);

        $shift = DB::transaction(function () use ($request, $validated, $openingAmount, $refillPacket, $atm, $branch) {
            $existing = $this->openShiftQuery($branch->id)->lockForUpdate()->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    'shift' => [__('A cash shift is already open. Close the current shift before opening a new one.')],
                ]);
            }

            $shift = PosCashShift::query()->create([
                'store_location_id' => $branch->id,
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
            'pool_balances' => $this->cashPoolService->balances($branch->id),
        ], __('Cash shift is open.'));
    }

    public function close(Request $request)
    {
        $validated = $request->validate([
            'store_location_id' => ['nullable', 'integer'],
            'closed_staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'closing_amount' => ['required', 'numeric', 'min:0'],
            'closing_withdraw' => ['nullable', 'numeric', 'min:0'],
            'closing_refill_cash' => ['nullable', 'numeric', 'min:0'],
            'remark' => ['nullable', 'string'],
        ]);
        $branch = $this->operationalBranch($request);

        $shift = DB::transaction(function () use ($request, $validated, $branch) {
            $openShift = $this->openShiftQuery($branch->id)->lockForUpdate()->first();
            if (! $openShift) {
                throw ValidationException::withMessages(['store_location_id' => [__('No open cash shift belongs to the selected Branch.')]]);
            }
            PosCashShift::query()->whereKey($openShift->id)->lockForUpdate()->first();

            $closingAmount = round((float) $validated['closing_amount'], 2);
            $withdraw = round((float) ($validated['closing_withdraw'] ?? 0), 2);
            $refillCash = round((float) ($validated['closing_refill_cash'] ?? 0), 2);

            $closeShift = PosCashShift::query()->create([
                'store_location_id' => $openShift->store_location_id,
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
            'pool_balances' => $this->cashPoolService->balances($branch->id),
        ], __('Cash shift closed.'));
    }

    public function summary(Request $request)
    {
        if (! $request->filled('store_location_id')) {
            $ids = $this->branchAccess->accessibleStoreLocations($request->user(), true)->pluck('id');
            $accounts = PosCashPoolAccount::query()->whereIn('store_location_id', $ids)->get();
            $openShifts = $this->openShiftQuery()->whereIn('store_location_id', $ids)->get();
            return $this->respond([
                'pool_balances' => [
                    'total_initial_cash' => round((float) $accounts->sum('total_initial_cash'), 2),
                    'total_withdraw' => round((float) $accounts->sum('total_withdraw'), 2),
                ],
                'open_shift' => null,
                'open_shifts' => $openShifts->map(fn ($shift) => $this->serializeShift($shift))->values(),
                'scope' => 'all_accessible_branches',
            ]);
        }
        $branch = $this->operationalBranch($request);
        $openShift = $this->openShiftQuery($branch->id)->first();

        return $this->respond([
            'pool_balances' => $this->cashPoolService->balances($branch->id),
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
            'branch_store_location_id' => ['nullable', 'integer'],
        ]);

        $branchId = isset($validated['branch_store_location_id']) ? (int) $validated['branch_store_location_id'] : null;
        if ($branchId) {
            $this->branchAccess->authorizeStoreLocation($request->user(), $branchId, true);
        }
        $accessibleIds = $this->branchAccess->accessibleStoreLocations($request->user(), true)->pluck('id');
        $query = PosCashShift::query()
            ->with([
                'opener:id,name,email',
                'closer:id,name,email',
                'openedStaff:id,name,email,phone',
                'closedStaff:id,name,email,phone',
                'linkedOpenShift.openedStaff:id,name,email,phone',
                'linkedOpenShift.opener:id,name,email',
            ])
            ->when($branchId, fn (Builder $q) => $q->where('store_location_id', $branchId))
            ->when(! $branchId, fn (Builder $q) => $q->whereIn('store_location_id', $accessibleIds))
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
     * Sum Cash Sales / Difference (Cash Sales − Withdraw) for CLOSE events in the current report filter.
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

    private function openShiftQuery(?int $storeLocationId = null): Builder
    {
        return PosCashShift::query()
            ->with(['opener:id,name,email', 'closer:id,name,email', 'openedStaff:id,name,email,phone', 'closedStaff:id,name,email,phone'])
            ->where('event_type', PosCashShift::EVENT_OPEN)
            ->whereDoesntHave('closeEvent')
            ->when($storeLocationId, fn (Builder $query) => $query->where('store_location_id', $storeLocationId))
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
            'store_location_id' => $shift->store_location_id ? (int) $shift->store_location_id : null,
            'store_location' => $shift->storeLocation ? ['id' => (int) $shift->storeLocation->id, 'name' => $shift->storeLocation->name, 'code' => $shift->storeLocation->code] : null,
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
            // Difference = Cash Sales − Withdraw (CLOSE events only).
            'difference' => $shift->isCloseEvent()
                ? round($cashSales - (float) ($shift->closing_withdraw ?? 0), 2)
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
            ->when($openShift->store_location_id, fn ($query) => $query->where('orders.store_location_id', $openShift->store_location_id))
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
            ->when($openShift->store_location_id, fn ($query) => $query->where('store_location_id', $openShift->store_location_id))
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

    private function operationalBranch(Request $request): StoreLocation
    {
        $id = (int) $request->input('store_location_id', $request->query('store_location_id', 0));
        if ($id <= 0) {
            throw ValidationException::withMessages(['store_location_id' => [__('A specific Branch is required for cash operations.')]]);
        }
        $branch = $this->branchAccess->authorizeStoreLocation($request->user(), $id, false);
        if (! $branch->is_pos_available) {
            throw ValidationException::withMessages(['store_location_id' => [__('The selected Branch is not available for POS.')]]);
        }
        return $branch;
    }
}
