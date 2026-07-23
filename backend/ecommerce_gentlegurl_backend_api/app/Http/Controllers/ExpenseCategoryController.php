<?php

namespace App\Http\Controllers;

use App\Models\ExpenseCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ExpenseCategoryController extends Controller
{
    public function index(Request $r)
    {
        $q = ExpenseCategory::query()->orderBy('sort_order')->orderBy('name');
        if ($r->boolean('active_only')) {
            $q->where('is_active', true);
        }

        return $this->respond($q->paginate(min(max($r->integer('per_page', 50), 1), 100)));
    }

    public function store(Request $r)
    {
        $v = $r->validate([
            'name' => 'required|string|max:100|unique:expense_categories,name',
            'description' => 'nullable|string',
        ]);

        $c = ExpenseCategory::create([
            'name' => trim($v['name']),
            'description' => $v['description'] ?? null,
            'sort_order' => ((int) ExpenseCategory::query()->max('sort_order')) + 1,
            'is_active' => true,
        ]);

        return $this->respond($c, 'Expense category created successfully.');
    }

    public function update(Request $r, ExpenseCategory $expenseCategory)
    {
        $v = $r->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('expense_categories', 'name')->ignore($expenseCategory->id)],
            'description' => 'nullable|string',
            'is_active' => 'required|boolean',
        ]);

        $expenseCategory->update([
            'name' => trim($v['name']),
            'description' => $v['description'] ?? null,
            'is_active' => $v['is_active'],
        ]);

        return $this->respond($expenseCategory, 'Expense category updated successfully.');
    }

    public function destroy(ExpenseCategory $expenseCategory)
    {
        if ($expenseCategory->expenses()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Referenced categories must be deactivated, not deleted.',
            ], 422);
        }

        $expenseCategory->delete();

        return $this->respond(null, 'Expense category deleted successfully.');
    }

    public function moveUp(ExpenseCategory $expenseCategory)
    {
        return DB::transaction(function () use ($expenseCategory) {
            $oldPosition = $expenseCategory->sort_order;

            $previous = ExpenseCategory::query()
                ->where('sort_order', '<', $expenseCategory->sort_order)
                ->orderByDesc('sort_order')
                ->first();

            if (! $previous) {
                return $this->respond(null, 'Expense category is already at the top.', false, 400);
            }

            $newPosition = $previous->sort_order;
            $expenseCategory->sort_order = $newPosition;
            $expenseCategory->save();

            $previous->sort_order = $oldPosition;
            $previous->save();

            return $this->respond([
                'id' => $expenseCategory->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], 'Expense category moved up successfully.');
        });
    }

    public function moveDown(ExpenseCategory $expenseCategory)
    {
        return DB::transaction(function () use ($expenseCategory) {
            $oldPosition = $expenseCategory->sort_order;

            $next = ExpenseCategory::query()
                ->where('sort_order', '>', $expenseCategory->sort_order)
                ->orderBy('sort_order')
                ->first();

            if (! $next) {
                return $this->respond(null, 'Expense category is already at the bottom.', false, 400);
            }

            $newPosition = $next->sort_order;
            $expenseCategory->sort_order = $newPosition;
            $expenseCategory->save();

            $next->sort_order = $oldPosition;
            $next->save();

            return $this->respond([
                'id' => $expenseCategory->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], 'Expense category moved down successfully.');
        });
    }
}
