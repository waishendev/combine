<?php
namespace Database\Seeders; use App\Models\ExpenseCategory; use Illuminate\Database\Seeder;
class ExpenseCategorySeeder extends Seeder { public function run(): void { foreach(['Rental','Utilities','Salary','Commission','Marketing','Maintenance','Office Supplies','Internet','Transport','Cleaning','Food','Miscellaneous'] as $sort=>$name) ExpenseCategory::firstOrCreate(['name'=>$name],['sort_order'=>$sort+1,'is_active'=>true]); } }
