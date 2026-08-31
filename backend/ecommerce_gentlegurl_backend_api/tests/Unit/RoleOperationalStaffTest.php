<?php

namespace Tests\Unit;

use App\Models\Role;
use PHPUnit\Framework\TestCase;

class RoleOperationalStaffTest extends TestCase
{
    public function test_staff_role_is_matched_by_name_regardless_of_case(): void
    {
        $this->assertTrue((new Role(['name' => 'Staff']))->isOperationalStaffRole());
        $this->assertTrue((new Role(['name' => 'staff']))->isOperationalStaffRole());
        $this->assertTrue((new Role(['name' => ' STAFF ']))->isOperationalStaffRole());
        $this->assertTrue(Role::isOperationalStaffRoleName('Staff'));
    }

    public function test_non_staff_roles_are_not_operational_staff(): void
    {
        $this->assertFalse((new Role(['name' => 'Admin']))->isOperationalStaffRole());
        $this->assertFalse((new Role(['name' => 'Staff Manager']))->isOperationalStaffRole());
        $this->assertFalse(Role::isOperationalStaffRoleName(null));
        $this->assertFalse(Role::isOperationalStaffRoleName(''));
    }
}
