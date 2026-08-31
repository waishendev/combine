<?php

namespace Tests\Unit;

use App\Http\Controllers\StaffController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class StaffIndexListsInactiveContractTest extends TestCase
{
    public function test_staffs_page_index_does_not_default_to_active_only(): void
    {
        $source = file_get_contents((new ReflectionClass(StaffController::class))->getFileName());
        $start = strpos($source, 'public function index(Request $request)');
        $end = strpos($source, 'public function exportCsv(Request $request)', $start);
        $indexSource = substr($source, $start, $end - $start);

        $this->assertStringContainsString("when(\$request->has('is_active')", $indexSource);
        $this->assertStringNotContainsString("where('is_active', true)", $indexSource);
    }

    public function test_staff_dropdown_options_still_default_to_active(): void
    {
        $source = file_get_contents((new ReflectionClass(StaffController::class))->getFileName());
        $start = strpos($source, 'public function options(Request $request)');
        $end = strpos($source, 'public function importCsv(Request $request)', $start);
        $optionsSource = substr($source, $start, $end - $start);

        $this->assertStringContainsString("where('is_active', true)", $optionsSource);
    }
}
