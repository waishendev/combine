<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsRedemptionItem;
use App\Models\Ecommerce\VoucherAssignLog;
use App\Models\Ecommerce\Voucher;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $loyaltySetting = $this->getActiveLoyaltySetting();
        $tierRules = $this->getActiveTierRules();
        $window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);

        $customers = Customer::query()
            ->when($request->filled('name'), fn($q) => $q->where('name', 'like', '%' . $request->string('name')->toString() . '%'))
            ->when($request->filled('email'), fn($q) => $q->where('email', $request->string('email')->toString()))
            ->when($request->filled('phone'), fn($q) => $q->where('phone', $request->string('phone')->toString()))
            ->when($request->filled('tier'), fn($q) => $q->where('tier', $request->string('tier')->toString()))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('created_from'), fn($q) => $q->whereDate('created_at', '>=', $request->date('created_from')))
            ->when($request->filled('created_to'), fn($q) => $q->whereDate('created_at', '<=', $request->date('created_to')))
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->through(function ($customer) use ($loyaltySetting, $tierRules, $window) {
                return $this->formatCustomerWithSummary($customer, $loyaltySetting, $tierRules, $window);
            });

        return $this->respond($customers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:customers,phone'],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $customer = Customer::create($validated + [
            'tier' => $validated['tier'] ?? 'normal',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return $this->respond($customer, __('Customer created successfully.'));
    }

    public function show(Customer $customer)
    {
        $loyaltySetting = $this->getActiveLoyaltySetting();
        $tierRules = $this->getActiveTierRules();
        $window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);

        return $this->respond($this->formatCustomerWithDetails($customer, $loyaltySetting, $tierRules, $window));
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique('customers', 'phone')->ignore($customer->id)],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $customer->fill($validated);
        $customer->save();

        return $this->respond($customer, __('Customer updated successfully.'));
    }

    public function destroy(Customer $customer)
    {
        if (in_array('deleted_at', $customer->getFillable())) {
            $customer->delete();
        } else {
            $customer->is_active = false;
            $customer->save();
        }

        return $this->respond(null, __('Customer deleted successfully.'));
    }

    public function assignVoucher(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'voucher_id' => ['required', 'integer', 'exists:vouchers,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:500'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
        ]);

        $voucher = Voucher::findOrFail($validated['voucher_id']);
        $now = Carbon::now();

        if (!$voucher->is_active) {
            throw ValidationException::withMessages([
                'voucher_id' => __('Selected voucher is not active.'),
            ]);
        }

        if ($voucher->end_at && $voucher->end_at->lt($now)) {
            throw ValidationException::withMessages([
                'voucher_id' => __('Selected voucher has expired.'),
            ]);
        }

        $startAt = array_key_exists('start_at', $validated)
            ? ($validated['start_at'] ? Carbon::parse($validated['start_at']) : null)
            : $voucher->start_at;
        $endAt = array_key_exists('end_at', $validated)
            ? ($validated['end_at'] ? Carbon::parse($validated['end_at']) : null)
            : $voucher->end_at;

        if ($voucher->start_at && $startAt && $startAt->lt($voucher->start_at)) {
            throw ValidationException::withMessages([
                'start_at' => __('Start date cannot be before voucher start date.'),
            ]);
        }

        if ($voucher->end_at && $endAt && $endAt->gt($voucher->end_at)) {
            throw ValidationException::withMessages([
                'end_at' => __('End date cannot be after voucher end date.'),
            ]);
        }

        if ($endAt && $endAt->lt($now)) {
            throw ValidationException::withMessages([
                'end_at' => __('End date cannot be in the past.'),
            ]);
        }

        $quantity = (int) ($validated['quantity'] ?? 1);

        $customerVoucher = DB::transaction(function () use (
            $customer,
            $voucher,
            $quantity,
            $now,
            $request,
            $startAt,
            $endAt,
            $validated
        ) {
            $customerVoucher = CustomerVoucher::create([
                'customer_id' => $customer->id,
                'voucher_id' => $voucher->id,
                'quantity_total' => $quantity,
                'quantity_used' => 0,
                'status' => 'active',
                'claimed_at' => $now,
                'assigned_by_admin_id' => $request->user()?->id,
                'assigned_at' => $now,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'expires_at' => $endAt,
                'note' => $validated['note'] ?? null,
            ]);

            VoucherAssignLog::create([
                'customer_id' => $customer->id,
                'voucher_id' => $voucher->id,
                'assigned_by_admin_id' => $request->user()?->id,
                'quantity' => $quantity,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'note' => $validated['note'] ?? null,
                'assigned_at' => $now,
            ]);

            return $customerVoucher;
        });

        return $this->respond(
            $customerVoucher->load('voucher'),
            __('Voucher assigned successfully.')
        );
    }

    protected function formatCustomerWithSummary(Customer $customer, ?LoyaltySetting $loyaltySetting, $tierRules, array $window)
    {
        $availablePoints = $this->getAvailablePoints($customer);
        $spentInWindow = $this->getSpentInWindow($customer, $window['start'], $window['end']);
        $nextTierData = $this->calculateNextTier($customer, $tierRules, $spentInWindow);

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'tier' => $customer->tier,
            'is_active' => $customer->is_active,
            'last_login_at' => $customer->last_login_at,
            'created_at' => $customer->created_at,
            'updated_at' => $customer->updated_at,
            'available_points' => $availablePoints,
            'spent_in_window' => $spentInWindow,
            'next_tier' => $nextTierData['tier'],
            'amount_to_next_tier' => $nextTierData['amount_to_reach'],
        ];
    }

    protected function formatCustomerWithDetails(Customer $customer, ?LoyaltySetting $loyaltySetting, $tierRules, array $window)
    {
        $availablePoints = $this->getAvailablePoints($customer);
        $spentInWindow = $this->getSpentInWindow($customer, $window['start'], $window['end']);
        $nextTierData = $this->calculateNextTier($customer, $tierRules, $spentInWindow);

        return $customer->toArray() + [
            'loyalty_summary' => [
                'available_points' => $availablePoints,
                'total_earned' => $this->getTotalEarnedPoints($customer),
                'total_redeemed' => $this->getTotalRedeemedPoints($customer),
                'window' => [
                    'months_window' => $window['months'],
                    'start_date' => $window['start']->toDateString(),
                    'end_date' => $window['end']->toDateString(),
                    'spent_in_window' => $spentInWindow,
                ],
                'next_tier' => $nextTierData['detail'],
            ],
        ];
    }

    protected function getActiveLoyaltySetting(): ?LoyaltySetting
    {
        return LoyaltySetting::where(function ($query) {
            $query->whereNull('rules_effective_at')
                ->orWhere('rules_effective_at', '<=', Carbon::now()->toDateString());
        })
            ->orderByDesc('rules_effective_at')
            ->orderByDesc('created_at')
            ->first();
    }

    protected function getActiveTierRules()
    {
        return MembershipTierRule::where('is_active', true)
            ->orderBy('min_spent_last_x_months')
            ->get();
    }

    protected function getWindowDates(int $months): array
    {
        $end = Carbon::now()->endOfDay();
        $start = Carbon::now()->subMonths($months)->startOfDay();

        return [
            'months' => $months,
            'start' => $start,
            'end' => $end,
        ];
    }

    protected function getAvailablePoints(Customer $customer): int
    {
        return (int) PointsEarnBatch::where('customer_id', $customer->id)
            ->where('points_remaining', '>', 0)
            ->where('expires_at', '>', Carbon::now())
            ->sum('points_remaining');
    }

    protected function getTotalEarnedPoints(Customer $customer): int
    {
        return (int) PointsEarnBatch::where('customer_id', $customer->id)
            ->sum('points_total');
    }

    protected function getTotalRedeemedPoints(Customer $customer): int
    {
        return (int) PointsRedemptionItem::whereHas('redemption', function ($query) use ($customer) {
            $query->where('customer_id', $customer->id);
        })->sum('points_used');
    }

    protected function getSpentInWindow(Customer $customer, Carbon $startDate, Carbon $endDate): float
    {
        return (float) Order::where('customer_id', $customer->id)
            ->whereIn('status', ['paid', 'completed'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->sum('grand_total');
    }

    protected function calculateNextTier(Customer $customer, $tierRules, float $spentInWindow): array
    {
        $tierRules = $tierRules->values();
        $currentIndex = $tierRules->search(function ($rule) use ($customer) {
            return $rule->tier === $customer->tier;
        });

        $nextRule = null;
        if ($currentIndex !== false && $currentIndex < ($tierRules->count() - 1)) {
            $nextRule = $tierRules[$currentIndex + 1];
        } elseif ($currentIndex === false) {
            $nextRule = $tierRules->firstWhere(function ($rule) use ($spentInWindow) {
                return $rule->min_spent_last_x_months > $spentInWindow;
            });
        }

        if (!$nextRule) {
            return [
                'tier' => null,
                'amount_to_reach' => null,
                'detail' => null,
            ];
        }

        $amountToReach = max($nextRule->min_spent_last_x_months - $spentInWindow, 0);

        return [
            'tier' => $nextRule->tier,
            'amount_to_reach' => $amountToReach > 0 ? $amountToReach : null,
            'detail' => [
                'tier' => $nextRule->tier,
                'threshold_amount' => $nextRule->min_spent_last_x_months,
                'amount_to_reach' => $amountToReach,
            ],
        ];
    }
}
