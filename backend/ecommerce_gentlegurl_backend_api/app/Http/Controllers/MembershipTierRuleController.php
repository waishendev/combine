<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\MembershipTierRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MembershipTierRuleController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $rules = MembershipTierRule::when($request->filled('tier'), function ($query) use ($request) {
                $query->where('tier', 'like', '%' . $request->get('tier') . '%');
            })
            ->when($request->filled('display_name'), function ($query) use ($request) {
                $query->where('display_name', 'like', '%' . $request->get('display_name') . '%');
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->orderBy('sort_order')
            ->paginate($perPage);

        return $this->respond($rules);
    }

    public function store(Request $request)
    {
        $validated = $this->validateRequest($request, true);

        // Automatically set sort_order to the last position (max + 1)
        $maxSortOrder = MembershipTierRule::max('sort_order') ?? 0;
        $validated['sort_order'] = $maxSortOrder + 1;

        $rule = MembershipTierRule::create($validated);

        return $this->respond($rule, __('Membership tier rule created successfully.'), 201);
    }

    public function show(MembershipTierRule $membershipTierRule)
    {
        return $this->respond($membershipTierRule);
    }

    public function update(Request $request, MembershipTierRule $membershipTierRule)
    {
        $validated = $this->validateRequest($request);

        $membershipTierRule->fill($validated);
        $membershipTierRule->save();

        return $this->respond($membershipTierRule, __('Membership tier rule saved successfully.'));
    }

    public function destroy(MembershipTierRule $membershipTierRule)
    {
        $membershipTierRule->delete();

        return $this->respond(null, __('Membership tier rule deleted successfully.'));
    }

    public function moveUp(MembershipTierRule $membershipTierRule)
    {
        return DB::transaction(function () use ($membershipTierRule) {
            $oldPosition = $membershipTierRule->sort_order;

            // Find the previous rule (lower sort_order)
            $previousRule = MembershipTierRule::where('sort_order', '<', $membershipTierRule->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousRule) {
                // Already at the top
                return $this->respond(null, __('Membership tier rule is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousRule->sort_order;

            $membershipTierRule->sort_order = $newPosition;
            $membershipTierRule->save();

            $previousRule->sort_order = $oldPosition;
            $previousRule->save();

            // Return metadata only
            return $this->respond([
                'id' => $membershipTierRule->id,
                'tier' => $membershipTierRule->tier,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Membership tier rule moved up successfully.'));
        });
    }

    public function moveDown(MembershipTierRule $membershipTierRule)
    {
        return DB::transaction(function () use ($membershipTierRule) {
            $oldPosition = $membershipTierRule->sort_order;

            // Find the next rule (higher sort_order)
            $nextRule = MembershipTierRule::where('sort_order', '>', $membershipTierRule->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextRule) {
                // Already at the bottom
                return $this->respond(null, __('Membership tier rule is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextRule->sort_order;

            $membershipTierRule->sort_order = $newPosition;
            $membershipTierRule->save();

            $nextRule->sort_order = $oldPosition;
            $nextRule->save();

            // Return metadata only
            return $this->respond([
                'id' => $membershipTierRule->id,
                'tier' => $membershipTierRule->tier,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Membership tier rule moved down successfully.'));
        });
    }

    private function validateRequest(Request $request, bool $isCreate = false): array
    {
        $tierRules = $isCreate
            ? ['required', 'string', 'max:30', 'unique:membership_tier_rules,tier']
            : ['sometimes', 'string', 'max:30'];

        $rules = [
            'tier' => $tierRules,
            'display_name' => $isCreate ? ['required', 'string', 'max:255'] : ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'badge_image_path' => ['nullable', 'string', 'max:255'],
            'min_spent_last_x_months' => $isCreate ? ['required', 'numeric'] : ['sometimes', 'numeric'],
            'months_window' => $isCreate ? ['required', 'integer'] : ['sometimes', 'integer'],
            'multiplier' => $isCreate ? ['required', 'numeric'] : ['sometimes', 'numeric'],
            'product_discount_percent' => ['sometimes', 'numeric'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        // Only allow sort_order in update, not in create
        if (!$isCreate) {
            $rules['sort_order'] = ['sometimes', 'integer'];
        }

        return $request->validate($rules);
    }
}
