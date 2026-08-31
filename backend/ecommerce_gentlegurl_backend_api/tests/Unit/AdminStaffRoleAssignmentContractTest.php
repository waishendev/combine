<?php

namespace Tests\Unit;

use App\Http\Controllers\AdminController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class AdminStaffRoleAssignmentContractTest extends TestCase
{
    public function test_admin_mutations_reject_new_staff_role_assignment(): void
    {
        $source = file_get_contents((new ReflectionClass(AdminController::class))->getFileName());

        $this->assertStringContainsString('rejectNewStaffRoleAssignment($assignableRoleIds, $target)', $source);
        $this->assertStringContainsString('$this->filterAssignableRoleIds($validated[\'role_ids\'] ?? [], $request->user(), $admin)', $source);
        $this->assertStringContainsString('Staff role can only be assigned from the Staffs page.', $source);
        $this->assertStringContainsString('isOperationalStaffRole()', $source);
    }

    public function test_admin_create_validates_roles_before_inserting_a_user(): void
    {
        $source = file_get_contents((new ReflectionClass(AdminController::class))->getFileName());
        $start = strpos($source, 'public function store(Request $request)');
        $end = strpos($source, 'public function show(Request $request, User $admin)', $start);
        $storeSource = substr($source, $start, $end - $start);

        $this->assertNotFalse(strpos($storeSource, 'filterAssignableRoleIds'));
        $this->assertLessThan(
            strpos($storeSource, 'User::create('),
            strpos($storeSource, 'filterAssignableRoleIds'),
        );
    }
}
