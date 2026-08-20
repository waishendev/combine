<?php

namespace App\Http\Controllers;

use App\Models\ExpenseCategory;
use App\Services\ExpenseBranchScope;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ExpenseCategoryController extends Controller
{
    public function __construct(private StoreLocationAccessService $branchAccess)
    {
    }

    private function scope(Request $request): ExpenseBranchScope
    {
        return ExpenseBranchScope::fromRequest($request, $this->branchAccess);
    }

    private function authorizeRecord(Request $request, ExpenseCategory $category): void
    {
        abort_unless($this->scope($request)->apply(ExpenseCategory::query())->whereKey($category->id)->exists(), 404);
    }

    public function index(Request $request)
    {
        $query = $this->scope($request)->apply(ExpenseCategory::query()->with('storeLocation')->withCount('expenses'))
            ->orderBy('store_location_id')->orderBy('sort_order')->orderBy('name');
        if ($request->boolean('active_only')) $query->where('is_active', true);

        return $this->respond($query->paginate(min(max($request->integer('per_page', 50), 1), 100)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'name' => ['required', 'string', 'max:100'],
            'description' => 'nullable|string',
        ]);
        $branchId = (int) $validated['store_location_id'];
        $this->branchAccess->authorizeStoreLocation($request->user(), $branchId);
        $request->validate(['name' => Rule::unique('expense_categories', 'name')->where('store_location_id', $branchId)]);

        $category = ExpenseCategory::create([
            'store_location_id' => $branchId,
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'sort_order' => ((int) ExpenseCategory::query()->where('store_location_id', $branchId)->max('sort_order')) + 1,
            'is_active' => true,
        ]);

        return $this->respond($category->load('storeLocation'), 'Expense category created successfully.');
    }

    public function update(Request $request, ExpenseCategory $expenseCategory)
    {
        $this->authorizeRecord($request, $expenseCategory);
        $scope = $this->scope($request);
        $validated = $request->validate([
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'name' => ['required', 'string', 'max:100'],
            'description' => 'nullable|string',
            'is_active' => 'required|boolean',
        ]);
        $branchId = (int) $validated['store_location_id'];
        $this->branchAccess->authorizeStoreLocation($request->user(), $branchId);
        $movingBranch = (int) $expenseCategory->store_location_id !== $branchId;
        if ($movingBranch && $scope->selectedStoreLocationId !== null) {
            throw ValidationException::withMessages([
                'store_location_id' => 'Expense Category ownership is locked while editing in a specific Branch context.',
            ]);
        }
        if ($movingBranch && $expenseCategory->expenses()->exists()) {
            throw ValidationException::withMessages([
                'store_location_id' => 'This Expense Category is already used by Expenses and cannot be moved to another Branch.',
            ]);
        }
        $request->validate(['name' => Rule::unique('expense_categories', 'name')->where('store_location_id', $branchId)->ignore($expenseCategory->id)]);
        $expenseCategory->update([
            'store_location_id' => $branchId,
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
        ]);

        return $this->respond($expenseCategory->load('storeLocation'), 'Expense category updated successfully.');
    }

    public function destroy(Request $request, ExpenseCategory $expenseCategory)
    {
        $this->authorizeRecord($request, $expenseCategory);
        if ($expenseCategory->expenses()->exists()) {
            return response()->json(['success' => false, 'message' => 'Referenced categories must be deactivated, not deleted.'], 422);
        }
        $expenseCategory->delete();
        return $this->respond(null, 'Expense category deleted successfully.');
    }

    public function moveUp(Request $request, ExpenseCategory $expenseCategory)
    {
        return $this->move($request, $expenseCategory, 'up');
    }

    public function moveDown(Request $request, ExpenseCategory $expenseCategory)
    {
        return $this->move($request, $expenseCategory, 'down');
    }

    private function move(Request $request, ExpenseCategory $category, string $direction)
    {
        $this->authorizeRecord($request, $category);
        return DB::transaction(function () use ($category, $direction) {
            $query = ExpenseCategory::query()->where('store_location_id', $category->store_location_id);
            $other = $direction === 'up'
                ? $query->where('sort_order', '<', $category->sort_order)->orderByDesc('sort_order')->first()
                : $query->where('sort_order', '>', $category->sort_order)->orderBy('sort_order')->first();
            if (! $other) return $this->respond(null, "Expense category is already at the {$direction}.", false, 400);
            $old = $category->sort_order;
            $category->update(['sort_order' => $other->sort_order]);
            $other->update(['sort_order' => $old]);
            return $this->respond(['id' => $category->id, 'old_position' => $old, 'new_position' => $category->sort_order], "Expense category moved {$direction} successfully.");
        });
    }
}
