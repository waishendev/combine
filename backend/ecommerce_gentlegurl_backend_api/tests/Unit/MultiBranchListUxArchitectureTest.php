<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class MultiBranchListUxArchitectureTest extends TestCase
{
    public function test_product_table_conditionally_renders_branches_and_counts_the_column(): void
    {
        $table = $this->frontend('ProductTable.tsx');
        $row = $this->frontend('ProductRow.tsx');

        $this->assertStringContainsString("...(isAllBranches ? [{ key: 'storeLocations', label: 'Branch' }", $table);
        $this->assertStringContainsString('showBranches={isAllBranches}', $table);
        $this->assertStringContainsString('{showBranches && (', $row);
        $this->assertStringContainsString("map((branch) => branch.name).join(', ') || 'Unassigned'", $row);
        $this->assertStringContainsString('const colCount = columns.length', $table);
    }

    public function test_category_table_conditionally_renders_branches_and_counts_the_column(): void
    {
        $table = $this->frontend('CategoryTable.tsx');
        $row = $this->frontend('CategoryRow.tsx');

        $this->assertStringContainsString("else qs.set('branch_scope', 'all')", $table);
        $this->assertStringContainsString("...(isAllBranches ? [{ key: 'availableBranches', label: 'Branch' }", $table);
        $this->assertStringContainsString('(isAllBranches ? 1 : 0)', $table);
        $this->assertStringContainsString('showBranches={isAllBranches}', $table);
        $this->assertStringContainsString('{showBranches && (', $row);
        $this->assertStringContainsString("map((branch) => branch.name).join(', ') || 'Unassigned'", $row);
    }

    private function frontend(string $file): string
    {
        return (string) file_get_contents(dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/components/'.$file);
    }
}
