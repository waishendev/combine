<?php
namespace App\Http\Controllers;
use App\Models\ExpenseCategory; use Illuminate\Http\Request; use Illuminate\Validation\Rule;
class ExpenseCategoryController extends Controller {
 public function index(Request $r){$q=ExpenseCategory::query()->orderBy('sort_order')->orderBy('name'); if($r->boolean('active_only'))$q->where('is_active',true); return $this->respond($q->paginate(min(max($r->integer('per_page',50),1),100)));}
 public function store(Request $r){$v=$r->validate(['name'=>'required|string|max:100|unique:expense_categories,name','description'=>'nullable|string','sort_order'=>'nullable|integer|min:0','is_active'=>'nullable|boolean']);$c=ExpenseCategory::create(['name'=>trim($v['name']),'description'=>$v['description']??null,'sort_order'=>$v['sort_order']??0,'is_active'=>$v['is_active']??true]);return $this->respond($c,'Expense category created successfully.');}
 public function update(Request $r,ExpenseCategory $expenseCategory){$v=$r->validate(['name'=>['required','string','max:100',Rule::unique('expense_categories','name')->ignore($expenseCategory->id)],'description'=>'nullable|string','sort_order'=>'required|integer|min:0','is_active'=>'required|boolean']);$expenseCategory->update(['name'=>trim($v['name']),'description'=>$v['description']??null,'sort_order'=>$v['sort_order'],'is_active'=>$v['is_active']]);return $this->respond($expenseCategory,'Expense category updated successfully.');}
 public function destroy(ExpenseCategory $expenseCategory){if($expenseCategory->expenses()->exists()) return response()->json(['success'=>false,'message'=>'Referenced categories must be deactivated, not deleted.'],422);$expenseCategory->delete();return $this->respond(null,'Expense category deleted successfully.');}
}
