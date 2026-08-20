<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseBranchScope;
use App\Services\StoreLocationAccessService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ExpenseController extends Controller
{
    public function __construct(private StoreLocationAccessService $branchAccess)
    {
    }

    private function scope(Request $request): ExpenseBranchScope
    {
        return ExpenseBranchScope::fromRequest($request, $this->branchAccess);
    }

    private function filtered(Request $request)
    {
        $query = $this->scope($request)->apply(
            Expense::query()->with(['category', 'creator', 'storeLocation']),
            'expenses.store_location_id'
        )->orderByDesc('expense_date')->orderByDesc('id');

        if ($month = $request->string('month')->toString()) {
            try {
                $date = Carbon::createFromFormat('Y-m', $month);
                $query->whereBetween('expense_date', [$date->startOfMonth()->toDateString(), $date->endOfMonth()->toDateString()]);
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

    public function index(Request $request)
    {
        $query = $this->filtered($request);
        $total = (clone $query)->sum('amount');
        $items = $query->paginate(min(max($request->integer('per_page', 15), 1), 100))->withQueryString();

        return $this->respond(['items' => $items, 'total_expense' => (string) $total]);
    }

    public function show(Request $request, Expense $expense)
    {
        $this->authorizeRecord($request, $expense);
        return $this->respond($expense->load(['category', 'creator', 'updater', 'storeLocation']));
    }

    private function rules(): array
    {
        return [
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'expense_category_id' => ['required', 'integer', 'exists:expense_categories,id'],
            'expense_date' => 'required|date',
            'title' => 'required|string|max:150',
            'amount' => 'required|numeric|gt:0|decimal:0,2',
            'remark' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'remove_receipt' => 'nullable|boolean',
        ];
    }

    private function authorizeAssignment(Request $request, array $validated): void
    {
        $branchId = (int) $validated['store_location_id'];
        $this->branchAccess->authorizeStoreLocation($request->user(), $branchId);
        $category = ExpenseCategory::query()->findOrFail($validated['expense_category_id']);
        if (! $category->is_active || $category->store_location_id !== $branchId) {
            throw ValidationException::withMessages([
                'expense_category_id' => 'The selected category does not belong to the Expense Branch.',
            ]);
        }
    }

    private function authorizeRecord(Request $request, Expense $expense): void
    {
        $exists = $this->scope($request)->apply(Expense::query())->whereKey($expense->getKey())->exists();
        abort_unless($exists, 404);
    }

    private function receipt(Request $request, ?Expense $expense): ?string
    {
        if ($request->hasFile('receipt')) {
            if ($expense?->receipt_path) Storage::disk('public')->delete($expense->receipt_path);
            return $request->file('receipt')->store('expenses/receipts', 'public');
        }
        if ($request->boolean('remove_receipt') && $expense?->receipt_path) {
            Storage::disk('public')->delete($expense->receipt_path);
            return null;
        }
        return $expense?->receipt_path;
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules());
        $this->authorizeAssignment($request, $validated);
        $user = $request->user();
        $expense = DB::transaction(function () use ($request, $validated, $user) {
            $date = Carbon::parse($validated['expense_date']);
            $prefix = 'EXP-'.$date->format('Ym').'-';
            $last = Expense::withTrashed()->where('expense_no', 'like', $prefix.'%')->lockForUpdate()->orderByDesc('id')->value('expense_no');
            $sequence = $last ? ((int) substr($last, -5)) + 1 : 1;
            return Expense::create([...$validated, 'expense_no' => $prefix.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT), 'receipt_path' => $this->receipt($request, null), 'created_by' => $user->id, 'updated_by' => $user->id]);
        });

        return $this->respond($expense->load(['category', 'creator', 'storeLocation']), 'Expense created successfully.');
    }

    public function update(Request $request, Expense $expense)
    {
        $this->authorizeRecord($request, $expense);
        $validated = $request->validate($this->rules());
        $this->authorizeAssignment($request, $validated);
        if ((int) $expense->store_location_id !== (int) $validated['store_location_id']) {
            throw ValidationException::withMessages(['store_location_id' => 'Moving an Expense to another Branch is not allowed.']);
        }
        $expense->update([...$validated, 'receipt_path' => $this->receipt($request, $expense), 'updated_by' => $request->user()->id]);

        return $this->respond($expense->fresh(['category', 'creator', 'updater', 'storeLocation']), 'Expense updated successfully.');
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->authorizeRecord($request, $expense);
        $expense->update(['updated_by' => $request->user()->id]);
        $expense->delete();
        return $this->respond(null, 'Expense archived successfully.');
    }

    public function export(Request $request)
    {
        $rows = $this->filtered($request)->get();
        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Expense No', 'Expense Date', 'Branch', 'Expense Title', 'Category', 'Amount', 'Remark', 'Created By', 'Created At']);
            foreach ($rows as $expense) fputcsv($out, [$expense->expense_no, $expense->expense_date->format('Y-m-d'), $expense->storeLocation?->name ?? 'Unassigned', $expense->title, $expense->category?->name, $expense->amount, $expense->remark, $expense->creator?->name, $expense->created_at]);
            fclose($out);
        }, 'expenses.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
