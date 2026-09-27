<?php
namespace Database\Seeders;
use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;
class PrintPlatformPermissionSeeder extends Seeder
{
    public function run(): void {
        $group=PermissionGroup::firstOrCreate(['name'=>'Print Platform'],['sort_order'=>100]);
        $definitions=['print.devices.view'=>'View print devices','print.devices.create'=>'Pair print devices','print.devices.revoke'=>'Revoke print devices','print.jobs.create-test'=>'Send test print jobs','print.jobs.view'=>'View print jobs','print.jobs.retry'=>'Retry print jobs'];
        $super=Role::where('name','infra_core_x1')->first();
        foreach($definitions as $slug=>$name){$p=Permission::updateOrCreate(['slug'=>$slug],['name'=>$name,'description'=>$name,'group_id'=>$group->id]);$super?->permissions()->syncWithoutDetaching([$p->id]);}
    }
}
