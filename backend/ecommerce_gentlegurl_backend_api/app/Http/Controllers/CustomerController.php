<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsRedemptionItem;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = $request->string('search')->toString();
        $loyaltySetting = $this->getActiveLoyaltySetting();
        $tierRules = $this->getActiveTierRules();
        $window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);

        $customers = Customer::when($search, function ($query) use ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        })->paginate($perPage)->through(function ($customer) use ($loyaltySetting, $tierRules, $window) {
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
            'password' => ['nullable', 'string', 'min:6'],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'avatar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date'],
        ]);

        $data = $validated;
        // Generate a random password if none is provided
        if (empty($data['password'])) {
            $data['password'] = \Illuminate\Support\Str::random(12);
        }
        
        $customer = Customer::create($data + [
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
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($customer->id)],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique('customers', 'phone')->ignore($customer->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'tier_marked_pending_at' => ['nullable', 'date'],
            'tier_effective_at' => ['nullable', 'date'],
            'avatar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date'],
        ]);

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $customer->fill($validated);
        $customer->save();

        return $this->respond($customer, __('Customer updated successfully.'));
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return $this->respond(null, __('Customer deleted successfully.'));
    }

    protected function formatCustomerWithSummary(Customer $customer, ?LoyaltySetting $loyaltySetting, $tierRules, array $window)
    {
        $availablePoints = $this->getAvailablePoints($customer);
        $spentInWindow = $this->getSpentInWindow($customer, $window['start'], $window['end']);
        $nextTierData = $this->calculateNextTier($customer, $tierRules, $spentInWindow);

        return $customer->toArray() + [
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
