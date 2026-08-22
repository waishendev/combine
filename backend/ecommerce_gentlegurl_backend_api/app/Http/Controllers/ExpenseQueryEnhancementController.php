<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseBranchScope;
use App\Services\StoreLocationAccessService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Expense / expense-categories query enhancement (P0 indexes + P1 scope memo + P2 APIs).
 *
 * Enhancement id: expense-query-enhancement-v1
 */
class ExpenseQueryEnhancementController extends Controller
{
    public const ENHANCEMENT = 'expense-query-enhancement-v1';

    public function __construct(private StoreLocationAccessService $branchAccess)
    {
    }

    private function scope(Request $request): ExpenseBranchScope
    {
        return ExpenseBranchScope::fromRequest($request, $this->branchAccess);
    }

    /**
     * CRM /expenses first paint — expenses page + active category dropdown in one request.
     */
    public function overview(Request $request)
    {
        $expenses = $this->buildExpensesPayload($request, withCreator: false);
        $categories = $this->buildCategoriesPayload($request, forDropdown: true);

        return $this->respond([
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'includes' => ['expenses', 'categories'],
            ],
            'expenses' => $expenses,
            'categories' => $categories,
        ]);
    }

    /**
     * CRM /expenses pagination / month / category filter (after first paint).
     */
    public function expenses(Request $request)
    {
        return $this->respond($this->buildExpensesPayload($request, withCreator: false));
    }

    /**
     * CRM /expense-categories list (keeps expenses_count for edit branch lock).
     */
    public function categories(Request $request)
    {
        return $this->respond($this->buildCategoriesPayload($request, forDropdown: false));
    }

    /**
     * @return array{items: LengthAwarePaginator, total_expense: string}
     */
    public function buildExpensesPayload(Request $request, bool $withCreator = false): array
    {
        $scope = $this->scope($request);
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $page = max($request->integer('page', 1), 1);

        $filtered = $this->filteredExpenses($request, $scope);
        $ordered = (clone $filtered)
            ->select('expenses.*')
            ->selectRaw('COUNT(*) OVER() as _win_total')
            ->selectRaw('COALESCE(SUM(expenses.amount) OVER(), 0) as _win_sum')
            ->reorder()
            ->orderByDesc('expense_date')
            ->orderByDesc('id');

        $rows = DB::query()
            ->fromSub($ordered->toBase(), 'expense_page')
            ->forPage($page, $perPage)
            ->get();

        $total = (int) ($rows->first()->_win_total ?? 0);
        $sum = (string) ($rows->first()->_win_sum ?? '0');
        $ids = $rows->pluck('id')->map(fn ($id) => (int) $id)->all();

        $with = ['category', 'storeLocation'];
        if ($withCreator) {
            $with[] = 'creator';
        }

        $models = $ids === []
            ? collect()
            : Expense::query()
                ->with($with)
                ->whereIn('id', $ids)
                ->get()
                ->sortBy(fn (Expense $expense) => array_search($expense->id, $ids, true))
                ->values();

        $items = new LengthAwarePaginator($models, $total, $perPage, $page, [
            'path' => $request->url(),
            'query' => $request->query(),
        ]);

        return [
            'items' => $items,
            'total_expense' => $sum,
        ];
    }

    /**
     * @return LengthAwarePaginator|\Illuminate\Support\Collection<int, ExpenseCategory>|array{data: list<mixed>}
     */
    public function buildCategoriesPayload(Request $request, bool $forDropdown): mixed
    {
        $scope = $this->scope($request);
        $perPage = min(max($request->integer('per_page', $forDropdown ? 100 : 50), 1), 100);

        $query = $scope->apply(ExpenseCategory::query()->with('storeLocation'))
            ->orderBy('store_location_id')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('active_only') || $forDropdown) {
            $query->where('is_active', true);
        }

        // Dropdown / overview: skip withCount (CRM filter never reads expenses_count).
        if ($forDropdown || $request->boolean('active_only')) {
            if ($forDropdown) {
                $rows = $query->limit($perPage)->get();

                return [
                    'data' => $rows,
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => $perPage,
                    'total' => $rows->count(),
                ];
            }

            return $query->paginate($perPage)->withQueryString();
        }

        return $query->withCount('expenses')->paginate($perPage)->withQueryString();
    }

    private function filteredExpenses(Request $request, ExpenseBranchScope $scope): Builder
    {
        $query = $scope->apply(Expense::query(), 'expenses.store_location_id');

        if ($month = $request->string('month')->toString()) {
            try {
                $date = Carbon::createFromFormat('Y-m', $month);
                $query->whereBetween('expense_date', [
                    $date->copy()->startOfMonth()->toDateString(),
                    $date->copy()->endOfMonth()->toDateString(),
                ]);
            } catch (\Throwable) {
                abort(422, 'Month must use YYYY-MM format.');
            }
        }
        if ($request->filled('expense_category_id')) {
            $query->where('expense_category_id', $request->integer('expense_category_id'));
        }
        if ($search = trim($request->string('search')->toString())) {
            $query->where(fn ($item) => $item->where('expense_no', 'like', "%{$search}%")
                ->orWhere('title', 'like', "%{$search}%")
                ->orWhere('remark', 'like', "%{$search}%")
                ->orWhereHas('category', fn ($category) => $category->where('name', 'like', "%{$search}%")));
        }

        return $query;
    }
}
